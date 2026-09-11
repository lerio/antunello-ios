import type { ComponentProps } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { usePrivacy } from '@/features/privacy/privacy-provider';
import { useTheme } from '@/hooks/use-theme';

type PrivacyValueProps = Omit<ComponentProps<typeof ThemedText>, 'children'> & {
  children: string | number;
  /**
   * Whether this value is sensitive. Defaults to `true`, meaning "hide when
   * privacy mode is on".
   *
   * Set it to an expression to reproduce the web app's selective rules — in the
   * transaction list only *income* is hidden, while day headers, summary figures
   * and the balance total hide unconditionally:
   *
   * @example
   * // In a list row: expenses stay readable, income is covered.
   * <PrivacyValue hidden={transaction.type === 'income'}>{amount}</PrivacyValue>
   *
   * // A headline total: always covered while privacy mode is on.
   * <PrivacyValue>{total}</PrivacyValue>
   */
  hidden?: boolean;
};

/**
 * Renders a financial value, covering it when privacy mode is on.
 *
 * **Why redaction rather than blur.** The web app hides values with
 * `filter: blur(6px)`. React Native declares that style for Android only — its
 * native platform implementations live under
 * `ReactCommon/react/renderer/components/view/platform/android`, and there is no
 * iOS counterpart — so on iOS it silently does nothing rather than erroring.
 * This was confirmed on device before the component was written.
 *
 * The replacement renders the text with a transparent colour and a filled
 * background, so the block occupies exactly the space the value would have. Two
 * consequences worth knowing:
 *
 *  - Layout is identical whether or not privacy mode is on, so toggling it never
 *    reflows the screen. This is the property the web app's blur was chosen for.
 *  - The block's width reveals how many digits a value has. That is inherent to
 *    redaction and matches how redacted documents read; the digits themselves
 *    are not recoverable, which is the point.
 */
export function PrivacyValue({ children, hidden = true, style, ...rest }: PrivacyValueProps) {
  const { enabled } = usePrivacy();
  const theme = useTheme();
  const covered = enabled && hidden;

  return (
    <ThemedText
      style={[
        style,
        covered && {
          color: 'transparent',
          backgroundColor: theme.backgroundSelected,
          borderRadius: Radius.small / 2,
          overflow: 'hidden',
        },
      ]}
      // The value is still present in the view tree, so screen readers would
      // otherwise announce exactly what is being hidden.
      accessibilityLabel={covered ? 'Hidden value' : undefined}
      {...rest}>
      {children}
    </ThemedText>
  );
}
