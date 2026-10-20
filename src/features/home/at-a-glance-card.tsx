import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import {
  culpritsOf,
  moodOf,
  percentageOverTypical,
  previousMonthWindow,
} from '@/features/home/home-math';
import { useMonthMovers, useMonthPace, type MonthMover } from '@/features/home/queries';
import { usePrivacy } from '@/features/privacy/privacy-provider';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';
import { symbolForCategory } from '@/lib/sf-symbols';

/** `+1.234,56 €` / `-310,00 €` */
function signed(amount: number): string {
  return `${amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(amount), 'EUR')}`;
}

/** Direction without relying on colour. */
function arrow(amount: number): string {
  return amount > 0 ? '▲' : amount < 0 ? '▼' : '–';
}

/** The subcategory is the useful label; the category is its context. */
function moverParts(mover: MonthMover): {
  title: string;
  subtitle: string | null;
} {
  return {
    title: mover.subCategory ?? mover.mainCategory,
    subtitle: mover.subCategory ? mover.mainCategory : null,
  };
}

/**
 * This month: what has been spent, how it compares with a typical month at the
 * same point, and which categories explain the gap.
 *
 * The figures come from `get_month_pace` / `get_month_movers`, shared with the
 * web app, so both clients show the same arithmetic.
 */
export function AtAGlanceCard() {
  const theme = useTheme();
  const { data: pace, isLoading, error } = useMonthPace();
  const { data: movers = [] } = useMonthMovers();
  const { enabled: privacyEnabled } = usePrivacy();
  const [detailOpen, setDetailOpen] = useState(true);

  const usual = pace?.typicalSpentToDate ?? null;
  const hasPace = usual !== null && usual > 0;
  const percent =
    pace && hasPace ? percentageOverTypical(pace.spentToDate, usual) : null;
  const mood = moodOf(percent);
  const moodColor =
    mood === 'over' ? theme.expense : mood === 'under' ? theme.income : theme.textSecondary;
  const culprits = culpritsOf(movers, mood);

  // The bar reads left to right: spent so far, with a tick at the usual level.
  // The 10% headroom keeps an over-spend visible instead of clipping at 100%.
  const scale =
    pace && usual !== null && usual > 0
      ? Math.max(pace.spentToDate, usual) * 1.1
      : 1;
  const spentWidth = pace ? Math.min(100, (pace.spentToDate / scale) * 100) : 0;
  const usualPosition =
    usual !== null && usual > 0 ? Math.min(100, (usual / scale) * 100) : 0;
  const usualLabelLeft = Math.min(94, Math.max(6, usualPosition));

  // Extra spending versus last month is bad news, so its colour rule is
  // inverted: positive is unfavourable here.
  const vsPrevMonth =
    pace && pace.prevMonthNetToDay !== null
      ? pace.netToDate - pace.prevMonthNetToDay
      : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.separator,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <View style={styles.headerRow}>
        <ThemedText
          accessibilityRole="header"
          themeColor="textSecondary"
          style={styles.sectionLabel}>
          THIS MONTH
        </ThemedText>
        <Pressable
          onPress={() => setDetailOpen((open) => !open)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailOpen }}
          accessibilityLabel={detailOpen ? 'Hide details' : 'Show details'}
          style={styles.toggle}>
          <SymbolView
            name={detailOpen ? 'chevron.up' : 'chevron.down'}
            size={13}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      </View>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.errorText}>
          {messageOf(error)}
        </ThemedText>
      ) : isLoading || !pace ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.heroRow}>
            <PrivacyValue style={styles.total}>
              {formatCurrency(pace.spentToDate, 'EUR')}
            </PrivacyValue>
            {percent !== null ? (
              <View
                accessible={!privacyEnabled}
                accessibilityLabel={
                  mood === 'inline'
                    ? 'Spending in line with usual'
                    : `Spending ${Math.round(Math.abs(percent))} percent ${
                        mood === 'over' ? 'above' : 'below'
                      } usual`
                }
                style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                <PrivacyValue style={[styles.chipText, { color: moodColor }]}>
                  {mood === 'inline'
                    ? 'In line with usual'
                    : `${arrow(percent)} ${Math.round(Math.abs(percent))}% vs usual`}
                </PrivacyValue>
              </View>
            ) : null}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.caption}>
            spent so far
          </ThemedText>

          {hasPace ? (
            <View style={styles.pace}>
              <View style={[styles.paceTrack, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.paceFill,
                    { width: `${spentWidth}%`, backgroundColor: moodColor },
                  ]}
                />
                <View
                  style={[
                    styles.paceTick,
                    { left: `${usualPosition}%`, backgroundColor: theme.textSecondary },
                  ]}
                />
              </View>
              <ThemedText
                themeColor="textSecondary"
                style={[styles.paceLabel, { left: `${usualLabelLeft}%` }]}>
                usual
              </ThemedText>
            </View>
          ) : null}

          {detailOpen ? (
            <>
          {culprits.length > 0 ? (
            <View style={styles.drivers}>
              <ThemedText themeColor="textSecondary" style={styles.listHeader}>
                vs usual
              </ThemedText>
              {culprits.map((mover) => {
                const { title, subtitle } = moverParts(mover);
                return (
                  <View
                    key={`${mover.mainCategory}|${mover.subCategory ?? ''}`}
                    style={styles.moverRow}>
                    <View
                      style={[
                        styles.iconBubble,
                        { backgroundColor: theme.backgroundElement },
                      ]}>
                      <SymbolView
                        name={symbolForCategory(mover.mainCategory)}
                        size={16}
                        tintColor={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.moverText}>
                      <ThemedText numberOfLines={1} style={styles.moverTitle}>
                        {title}
                      </ThemedText>
                      {subtitle ? (
                        <ThemedText
                          themeColor="textSecondary"
                          numberOfLines={1}
                          style={styles.moverSubtitle}>
                          {subtitle}
                        </ThemedText>
                      ) : null}
                    </View>
                    <PrivacyValue style={[styles.moverAmount, { color: moodColor }]}>
                      {signed(mover.delta)}
                    </PrivacyValue>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.comparisons}>
            {vsPrevMonth !== null ? (
              <View style={[styles.comparisonRow, { borderTopColor: theme.separator }]}>
                <ThemedText themeColor="textSecondary" style={styles.comparisonLabel}>
                  {`Spent vs ${previousMonthWindow(pace.monthStart, pace.asOfDate)}`}
                </ThemedText>
                <PrivacyValue
                  style={[
                    styles.comparisonValue,
                    {
                      color:
                        vsPrevMonth > 0
                          ? theme.expense
                          : vsPrevMonth < 0
                            ? theme.income
                            : theme.textSecondary,
                    },
                  ]}>
                  {`${arrow(vsPrevMonth)} ${signed(vsPrevMonth)}`}
                </PrivacyValue>
              </View>
            ) : null}

            <View style={[styles.comparisonRow, { borderTopColor: theme.separator }]}>
              <ThemedText themeColor="textSecondary" style={styles.comparisonLabel}>
                Net cash flow, last 30 days
              </ThemedText>
              <PrivacyValue
                style={[
                  styles.comparisonValue,
                  { color: pace.prior30dNet >= 0 ? theme.income : theme.expense },
                ]}>
                {`${arrow(pace.prior30dNet)} ${signed(pace.prior30dNet)}`}
              </PrivacyValue>
            </View>
          </View>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    padding: Spacing.two,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  total: {
    fontSize: 32,
    // Explicit: ThemedText's default lineHeight is 24 and would clip the glyphs.
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 99,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 12,
  },
  pace: {
    marginTop: Spacing.one,
    paddingBottom: Spacing.four,
  },
  paceTrack: {
    height: 6,
    borderRadius: 3,
  },
  paceFill: {
    height: 6,
    borderRadius: 3,
  },
  paceTick: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 14,
    borderRadius: 1,
    marginLeft: -1,
  },
  paceLabel: {
    position: 'absolute',
    top: 12,
    marginLeft: -12,
    fontSize: 10,
    lineHeight: 12,
  },
  drivers: {
    marginTop: Spacing.one,
  },
  listHeader: {
    fontSize: 12,
  },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moverText: {
    flex: 1,
  },
  moverTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  moverSubtitle: {
    fontSize: 12,
  },
  moverAmount: {
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  comparisons: {
    marginTop: Spacing.one,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 12,
  },
  comparisonValue: {
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 13,
  },
});
