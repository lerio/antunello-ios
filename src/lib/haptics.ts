/**
 * Haptics, named by what happened rather than by which motor fired.
 *
 * Call sites say `hapticSuccess()` where a transaction saved and `hapticError()`
 * where one did not. That reads as intent, and it means the vocabulary is fixed
 * in one file rather than spelled out as `NotificationFeedbackType.Success` at
 * every site — where three different developers (or the same one on three days)
 * would pick three different feedback types for the same event.
 *
 * ## What is deliberately haptic-free
 *
 * Most of the app. iOS already taps for tab changes, picker wheels and
 * pull-to-refresh, and adding to those reads as noise rather than feedback. What
 * is left is the set below: the moments where something the user cannot see —
 * a write that went to a server — has finished.
 *
 * Every call is fire-and-forget and swallows its own failure. Haptics are
 * decoration; a device without a Taptic Engine, or one with them switched off,
 * must not have that turn into an unhandled rejection in the middle of a save.
 */

import * as Haptics from 'expo-haptics';

/**
 * A write succeeded: a transaction saved, a bank row accepted, a sync finished.
 *
 * The double-tap of the success notification, which is the strongest signal iOS
 * offers for "that worked".
 */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/**
 * Something failed in a way the user needs to act on.
 *
 * Distinct from `hapticSuccess` on purpose: the two are the only feedback for a
 * save whose result may be off screen, and a failure that feels like a success
 * is worse than no feedback at all.
 */
export function hapticError(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

/**
 * A selection changed while a control stayed put.
 *
 * For toggling a filter chip or choosing from a picker — the light tick that
 * says the tap registered, without the weight of a completed action.
 */
export function hapticSelect(): void {
  void Haptics.selectionAsync().catch(() => undefined);
}
