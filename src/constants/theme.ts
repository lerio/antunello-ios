/**
 * Design tokens for the app.
 *
 * Matches the web app's shadcn/ui HSL palette (converted to RGB hex) so both
 * clients are visually identical. Money colors use the web app's --positive/
 * --negative/--warning tokens.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A0A0A',           // foreground: 0 0% 3.9%
    textSecondary: '#737373',  // muted-foreground: 0 0% 45.1%
    textSecondary60: '#73737399', // 60% opacity for pace bar inline (web `bg-muted-foreground/60`)
    /** Chart line/fill — matches web `hsl(var(--foreground))`. */
    chartLine: '#0A0A0A',
    /** Page background — matches web body `bg-gray-50`. */
    background: '#F9FAFB',     // gray-50
    /** Top bar background — matches web header `bg-white`. */
    header: '#FFFFFF',
    /** Muted/secondary surfaces — matches web `bg-muted`. */
    backgroundElement: '#F5F5F5',  // muted: 0 0% 96.1%
    backgroundSelected: '#E5E5E5',
    /** Card surface — matches web `bg-card` (white). */
    card: '#FFFFFF',           // card: 0 0% 100%
    /** Borders — matches web `border-border`. */
    separator: '#E5E5E5',      // border: 0 0% 89.8%
    /** Accent (primary actions) — matches web `bg-primary`. */
    tint: '#171717',           // primary: 0 0% 9%
    /** Text on accent. */
    onTint: '#FAFAFA',         // primary-foreground: 0 0% 98%

    /** Money in — matches web `--positive` (142 72% 29%). */
    income: '#166534',
    /** Money out — matches web `--negative` (0 72% 42%). */
    expense: '#B91C1C',
    /** 10% opacity for chip backgrounds (web `bg-positive/10`). */
    income10: '#1665341A',
    /** 10% opacity for chip backgrounds (web `bg-negative/10`). */
    expense10: '#B91C1C1A',
    /** Movements between funds — neither a gain nor a loss. */
    transfer: '#525252',
    /** Approaching a budget limit — matches web `--warning` (32 95% 37%). */
    warning: '#B45309',
    /** Destructive actions — matches web `--destructive` (0 84.2% 60.2%). */
    destructive: '#DC2626',
  },
  dark: {
    text: '#FAFAFA',           // foreground: 0 0% 98%
    textSecondary: '#A3A3A3',  // muted-foreground: 0 0% 63.9%
    textSecondary60: '#A3A3A399', // 60% opacity for pace bar inline (web `bg-muted-foreground/60`)
    /** Chart line/fill — matches web dark `hsl(var(--foreground))`. */
    chartLine: '#FAFAFA',
    /** Page background — matches web body `bg-gray-900`. */
    background: '#101828',     // gray-900
    /** Top bar background — matches web header `bg-gray-800`. */
    header: '#1E2939',         // gray-800
    /** Muted/secondary surfaces — matches web dark `bg-muted`. */
    backgroundElement: '#18181B',  // muted: 0 0% 14.9%
    backgroundSelected: '#27272A',
    /** Card surface — matches web dark `bg-card` (gray-800). */
    card: '#1E2939',           // gray-800
    /** Borders — matches web dark `border-border`. */
    separator: '#27272A',      // border: 0 0% 14.9%
    tint: '#FAFAFA',           // primary: 0 0% 98%
    onTint: '#171717',         // primary-foreground: 0 0% 9%

    /** Money in — matches web dark `--positive` (142 69% 58%). */
    income: '#4ADE80',
    /** Money out — matches web dark `--negative` (0 91% 71%). */
    expense: '#F87171',
    /** 10% opacity for chip backgrounds (web `bg-positive/10`). */
    income10: '#4ADE801A',
    /** 10% opacity for chip backgrounds (web `bg-negative/10`). */
    expense10: '#F871711A',
    transfer: '#A3A3A3',
    /** Warning — matches web dark `--warning` (38 92% 50%). */
    warning: '#FBBF24',
    destructive: '#EF4444',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export type SemanticColor = 'income' | 'expense' | 'transfer' | 'warning' | 'destructive';

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


/**
 * Layout values shared with the web app's mobile layout. Every screen and card
 * takes its gutter, gap and card padding from here, so a spacing change is one
 * edit — the web equivalent is `PageContainer`/`PageStack`/`Card`.
 *
 * Note that `Spacing.four` is 24, not the 16 of web's `p-4`; use these instead.
 */
export const Layout = {
  /** Web `px-4`: the page's left and right gutter. */
  gutter: 16,
  /** Web `pt-4`: space between the header band and the first element. */
  pageTop: 16,
  /** Web `gap-4`: space between sibling cards. */
  stackGap: 16,
  /** Web `p-4`: inside a card. */
  cardPadding: 16,
  /** Web `rounded-2xl` is 1rem = 16px. */
  cardRadius: 16,
  /** Gap between the stacked blocks inside a card. */
  cardGap: 8,
  /** Web `h-8 w-8`: an icon button in a card's title row. */
  iconButton: 32,
} as const;

/** Web `shadow-sm`. */
export const CardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
} as const;
