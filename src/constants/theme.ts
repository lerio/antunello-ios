/**
 * Design tokens for the app.
 *
 * The base palette follows the Expo template's shape (a light/dark record keyed
 * by `ThemeColor`), extended with the semantic colors this app needs to talk
 * about money. The financial values are taken from Apple's system palette so
 * they sit naturally next to native chrome and read correctly in both
 * appearances.
 *
 * Money colors are semantic, never literal: read `theme.income` / `theme.expense`
 * rather than a hex value, so a palette change lands in one place.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    card: '#FFFFFF',
    separator: '#E5E5EA',
    tint: '#007AFF',

    /** Money in. */
    income: '#248A3D',
    /** Money out. */
    expense: '#D70015',
    /** Movements between funds — neither a gain nor a loss. */
    transfer: '#8E8E93',
    /** Approaching a budget limit, or a non-blocking warning. */
    warning: '#C93400',
    /** Destructive actions, and budgets past their limit. */
    destructive: '#D70015',
  },
  dark: {
    text: '#ffffff',
    textSecondary: '#B0B4BA',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    card: '#1C1C1E',
    separator: '#38383A',
    tint: '#0A84FF',

    income: '#30D158',
    expense: '#FF453A',
    transfer: '#98989D',
    warning: '#FF9F0A',
    destructive: '#FF453A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** The resolved palette for one appearance. */
export type Theme = (typeof Colors)['light'];

/**
 * System font descriptors. These are iOS-only names, which is one reason this
 * app targets iOS alone — `ui-rounded` and `ui-monospace` have no clean
 * equivalent elsewhere.
 */
export const Fonts = Platform.select({
  ios: {
    /** `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
} as const;

/**
 * Height of the native tab bar, for content that must clear it — floating
 * action buttons, list bottom padding.
 */
export const BottomTabInset = Platform.select({ ios: 50, default: 80 }) ?? 0;

export const MaxContentWidth = 800;
