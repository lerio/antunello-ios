#!/usr/bin/env node

/**
 * Builds the app, signs it, and installs it on the connected iPhone.
 *
 * Free Apple provisioning expires after seven days, after which the app stops
 * launching. Running this again is the fix: it rebuilds with
 * `-allowProvisioningUpdates`, which asks Apple for a fresh profile, and installs
 * over the existing app, so the signed-in session and cached data survive.
 *
 *   npm run ios:install            Release: embedded JS, no Metro needed (daily use)
 *   npm run ios:install:debug      Debug: loads JS from Metro over the LAN
 *
 * Options (after `--` when run through npm):
 *   --debug           Build the Debug configuration instead of Release.
 *   --device <id>     A device name or UDID. Needed only when several physical
 *                     iPhones are paired; otherwise the one found is used.
 *   --launch          Open the app after installing. The phone must be unlocked.
 *   --jobs <n>        Concurrent compiler jobs (default 4). A full build at the
 *                     default parallelism can push a 24 GB Mac into heavy swap.
 *   --dry-run         Print what would run, and run nothing.
 *
 * Every problem this script checks for was one that cost time before; the reasons
 * are in CLAUDE.md, "Signing: why a plain `expo run:ios` may fail".
 */

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IOS_DIR = join(ROOT, 'ios');
const BUNDLE_ID = 'com.lerio.antunello';
const WORKSPACE = 'Antunello.xcworkspace';
const SCHEME = 'Antunello';

/** A physical device's UDID, as opposed to a simulator's plain UUID. */
const PHYSICAL_UDID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}$/;

function parseArgs(argv) {
  const options = { configuration: 'Release', device: null, launch: false, jobs: 4, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--debug') options.configuration = 'Debug';
    else if (arg === '--launch') options.launch = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--device') options.device = argv[(i += 1)];
    else if (arg === '--jobs') options.jobs = Number(argv[(i += 1)]);
    else fail(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.jobs) || options.jobs < 1) fail('--jobs needs a positive integer.');
  if (argv.includes('--device') && !options.device) fail('--device needs a name or UDID.');
  return options;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

/** Runs a command to completion and returns its output, or null on failure. */
function capture(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

/**
 * Runs a long command, writing its output to a log and showing only a heartbeat,
 * since a build prints tens of thousands of lines nobody reads.
 *
 * @returns {Promise<number>} The exit code.
 */
function runLogged(command, args, cwd, logPath) {
  return new Promise((resolveRun) => {
    const log = createWriteStream(logPath);
    const child = spawn(command, args, { cwd });
    const started = Date.now();

    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });

    const beat = setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000);
      process.stdout.write(`\r  building… ${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`);
    }, 1000);

    child.on('close', (code) => {
      clearInterval(beat);
      process.stdout.write('\r' + ' '.repeat(30) + '\r');
      log.end();
      resolveRun(code ?? 1);
    });
  });
}

/**
 * Chooses the device to install on.
 *
 * `devicectl` also lists simulators, so physical phones are told apart by UDID
 * shape. A UDID works for both `xcodebuild` and `devicectl` — the two tools
 * disagree only about *other* identifiers (see CLAUDE.md, signing trap 4).
 *
 * @returns {{ udid: string, name: string, connected: boolean }}
 */
function chooseDevice(requested) {
  const jsonPath = join(tmpdir(), `antunello-devices-${process.pid}.json`);
  if (capture('xcrun', ['devicectl', 'list', 'devices', '--json-output', jsonPath]) === null) {
    fail('Could not list devices. Is Xcode installed and its license accepted?');
  }

  const devices = JSON.parse(readFileSync(jsonPath, 'utf8')).result.devices.map((d) => ({
    udid: d.hardwareProperties?.udid ?? '',
    name: (d.deviceProperties?.name ?? '').trim(),
    platform: d.hardwareProperties?.platform,
    connected: d.connectionProperties?.tunnelState === 'connected',
  }));

  const phones = devices.filter((d) => d.platform === 'iOS' && PHYSICAL_UDID.test(d.udid));

  if (requested) {
    const match = phones.find((d) => d.udid === requested || d.name === requested);
    if (!match) {
      fail(
        `No paired iPhone matches "${requested}".\nFound: ${phones.map((d) => `${d.name} (${d.udid})`).join(', ') || 'none'}`,
      );
    }
    return match;
  }

  if (phones.length === 0) fail('No paired iPhone found. Connect it, unlock it, and trust this Mac.');

  const connected = phones.filter((d) => d.connected);
  const pool = connected.length > 0 ? connected : phones;
  if (pool.length > 1) {
    fail(`Several iPhones found; pass --device.\n${pool.map((d) => `  ${d.name}  ${d.udid}`).join('\n')}`);
  }
  return pool[0];
}

/**
 * Makes the first build work on a machine in an awkward state.
 *
 * Returns the list of things it had to fix, for the summary.
 */
function preflight(configuration, dryRun) {
  const fixed = [];

  if (!existsSync(join(IOS_DIR, WORKSPACE))) {
    fail('ios/ is missing. Run `npx expo prebuild --platform ios --no-install`, then `cd ios && pod install`.');
  }
  if (!existsSync(join(IOS_DIR, 'Pods'))) {
    fail('ios/Pods is missing. Run `cd ios && pod install` (prebuild wipes it).');
  }

  const identities = capture('security', ['find-identity', '-v', '-p', 'codesigning']) ?? '';
  if (/\b0 valid identities found/.test(identities)) {
    fail(
      'No valid code-signing identity. If a development certificate exists, the Apple WWDR G3 ' +
        'intermediate is probably missing from the keychain: see CLAUDE.md, signing trap 2.',
    );
  }

  // The prebuilt React core exists in Debug and Release variants, and a script
  // swaps them according to this marker. With no marker it assumes Debug and
  // does nothing, so a Release core left behind breaks the Debug link (and the
  // reverse) with hundreds of undefined facebook::react symbols. Naming the
  // *other* variant forces the swap.
  const marker = join(IOS_DIR, 'Pods', 'React-Core-prebuilt', '.last_build_configuration');
  if (!existsSync(marker)) {
    fixed.push(`${dryRun ? 'would set' : 'set'} the missing React core marker, so the right variant is extracted`);
    if (!dryRun) writeFileSync(marker, configuration === 'Debug' ? 'Release' : 'Debug');
  }

  return fixed;
}

/** Where Xcode will put the built app, asked rather than globbed. */
function findBuiltApp(configuration, udid) {
  const out = capture(
    'xcodebuild',
    ['-workspace', WORKSPACE, '-scheme', SCHEME, '-configuration', configuration, '-destination', `id=${udid}`, '-showBuildSettings', '-json'],
    IOS_DIR,
  );
  if (out === null) return null;

  const settings = JSON.parse(out)[0]?.buildSettings;
  return settings ? join(settings.TARGET_BUILD_DIR, settings.FULL_PRODUCT_NAME) : null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { configuration, dryRun } = options;

  step(`Configuration: ${configuration}${dryRun ? '  (dry run)' : ''}`);

  const device = chooseDevice(options.device);
  console.log(`  device: ${device.name} (${device.udid})${device.connected ? '' : '  (no active connection yet; devicectl connects on demand)'}`);

  const fixed = preflight(configuration, dryRun);
  for (const note of fixed) console.log(`  fixed: ${note}`);

  const buildArgs = [
    '-workspace', WORKSPACE,
    '-scheme', SCHEME,
    '-configuration', configuration,
    '-destination', `id=${device.udid}`,
    // The two flags `expo run:ios` does not pass, and which make a build fail
    // with "Automatic signing is disabled" once the profile has lapsed.
    '-allowProvisioningUpdates',
    'CODE_SIGN_STYLE=Automatic',
    '-jobs', String(options.jobs),
    'build',
  ];

  if (dryRun) {
    console.log(`\n  cd ios && xcodebuild ${buildArgs.join(' ')}`);
    console.log(`  xcrun devicectl device install app --device ${device.udid} <built Antunello.app>`);
    if (options.launch) console.log(`  xcrun devicectl device process launch --terminate-existing --device ${device.udid} ${BUNDLE_ID}`);
    return;
  }

  step('Building and signing (a full build takes several minutes; quit Xcode first to save memory)');
  const logDir = join(IOS_DIR, 'build');
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `install-${configuration.toLowerCase()}.log`);

  const code = await runLogged('xcodebuild', buildArgs, IOS_DIR, logPath);
  if (code !== 0) {
    const log = readFileSync(logPath, 'utf8');
    const errors = [...new Set(log.split('\n').filter((line) => /\berror:|Undefined symbols|No profiles for/.test(line)))];
    console.error(`\nBuild failed (exit ${code}). First errors:\n`);
    console.error(errors.slice(0, 8).map((line) => `  ${line.trim().slice(0, 240)}`).join('\n') || '  (none matched; see the log)');
    fail(`Full log: ${logPath}\nCommon causes are listed in CLAUDE.md, "Signing: why a plain \`expo run:ios\` may fail".`);
  }
  console.log('  built.');

  const app = findBuiltApp(configuration, device.udid);
  if (!app || !existsSync(app)) fail(`Build succeeded but the app was not found${app ? ` at ${app}` : ''}.`);

  step(`Installing ${app.split('/').slice(-3).join('/')}`);
  const install = spawnSync('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device.udid, app], { stdio: 'inherit' });
  if (install.status !== 0) {
    fail('Install failed. Is the phone connected, unlocked and trusting this Mac?');
  }

  if (options.launch) {
    step('Launching');
    const launch = spawnSync('xcrun', ['devicectl', 'device', 'process', 'launch', '--terminate-existing', '--device', device.udid, BUNDLE_ID], { stdio: 'inherit' });
    if (launch.status !== 0) console.error('  Launch failed; the phone is probably locked. Open the app by hand.');
  }

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  console.log(`\n✔ Installed. The profile lasts seven days: run this again before ${expires.toDateString()}.`);
  if (configuration === 'Debug') console.log('  Debug build: start Metro with `npm start` before opening the app.');
}

main().catch((error) => {
  console.error(`\ninstall-device failed: ${error.message}\n`);
  process.exit(1);
});
