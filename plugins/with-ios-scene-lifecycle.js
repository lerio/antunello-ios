/**
 * Adopts the UIScene lifecycle on iOS.
 *
 * iOS 27 traps at launch (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`,
 * SIGTRAP) for an app with no scene manifest. Expo SDK 57 and React Native 0.86
 * both still build the window inside `application(_:didFinishLaunchingWithOptions:)`,
 * so the generated native project needs two changes:
 *
 *  1. an `UIApplicationSceneManifest` naming a scene delegate, and
 *  2. a `SceneDelegate` that creates the window and starts React Native, with the
 *     window creation removed from `AppDelegate`.
 *
 * Both are applied on every prebuild, because `ios/` is generated and gitignored.
 * Delete this plugin once Expo ships scene support upstream.
 */

const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');

const MARKER = 'SceneDelegate (added by with-ios-scene-lifecycle)';

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

`;

const SCENE_DELEGATE = `
// ${MARKER}
//
// iOS 27 requires the UIScene lifecycle, so the window is created here rather
// than in \`AppDelegate.didFinishLaunchingWithOptions\`. Without a scene manifest
// the app is killed at launch with SIGTRAP.
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // A cold start from a link carries the URL here, not in the app delegate's
    // launch options, so it is handed to React Native as launch options.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Linking API
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal Links
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
}

function withSceneDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, mod.modRequest.projectName, 'AppDelegate.swift');
      let source = fs.readFileSync(file, 'utf8');

      // Idempotent: a second prebuild must not duplicate the class.
      if (source.includes(MARKER)) return mod;

      if (!source.includes(WINDOW_BLOCK)) {
        throw new Error(
          'with-ios-scene-lifecycle: AppDelegate.swift no longer matches the expected template, ' +
            'so the window block cannot be moved to a SceneDelegate. Update plugins/with-ios-scene-lifecycle.js.',
        );
      }

      source = source.replace(WINDOW_BLOCK, '') + SCENE_DELEGATE;
      fs.writeFileSync(file, source);
      return mod;
    },
  ]);
}

module.exports = (config) => withSceneDelegate(withSceneManifest(config));
