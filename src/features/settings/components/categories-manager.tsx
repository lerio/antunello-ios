import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Card, CardIconButton } from '@/components/card';
import { CategoryGlyph } from '@/components/category-icon';
import { OutlineButton } from '@/components/outline-button';
import { ThemedText } from '@/components/themed-text';
import { Layout, Spacing } from '@/constants/theme';
import { categorySections, subcategoryKey } from '@/features/settings/category-sections';
import { useCategoryCounts } from '@/features/settings/use-category-counts';
import { useTheme } from '@/hooks/use-theme';

/**
 * Editing categories means migrating the transactions that use them, which is
 * not designed yet. Until it is, every action is a placeholder.
 */
function notAvailable() {
  Alert.alert('Not available yet', "Editing categories isn't available yet.");
}

/** A pill with a transaction count; nothing while the counts load. */
function CountBadge({ count }: { count: number | undefined }) {
  const theme = useTheme();
  if (count === undefined) return null;

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.backgroundElement }]}
      accessibilityLabel={`${count} ${count === 1 ? 'transaction' : 'transactions'}`}>
      <ThemedText themeColor="textSecondary" style={styles.badgeLabel}>
        {count}
      </ThemedText>
    </View>
  );
}

/**
 * Settings → Categories: the categories grouped Income / Expense / Movement,
 * each with its subcategories and a transaction count, and the add / edit /
 * delete controls. The controls are UI only for now, as on web.
 */
export function CategoriesManager() {
  const theme = useTheme();
  const { data: counts } = useCategoryCounts();

  return (
    <>
      {categorySections().map((section) => (
        <View key={section.title} style={styles.section}>
          <ThemedText themeColor="textSecondary" accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>

          <View style={styles.cards}>
            {section.categories.map((cat) => (
              <Card key={cat.category}>
                <View style={styles.head}>
                  <View style={styles.title}>
                    <CategoryGlyph category={cat.category} size={20} color={theme.textSecondary} />
                    <ThemedText style={styles.categoryName}>{cat.category}</ThemedText>
                    <CountBadge count={counts ? (counts.byCategory[cat.category] ?? 0) : undefined} />
                  </View>
                  <View style={styles.actions}>
                    <CardIconButton symbol="pencil" label={`Edit ${cat.category}`} onPress={notAvailable} />
                    <CardIconButton symbol="trash" label={`Delete ${cat.category}`} onPress={notAvailable} />
                  </View>
                </View>

                <View>
                  {cat.subcategories.map((sub, index) => (
                    <View
                      key={sub}
                      style={[
                        styles.subRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.separator,
                        },
                      ]}>
                      <View style={styles.title}>
                        <ThemedText style={styles.subName}>{sub}</ThemedText>
                        <CountBadge
                          count={
                            counts
                              ? (counts.bySubcategory[subcategoryKey(cat.category, sub)] ?? 0)
                              : undefined
                          }
                        />
                      </View>
                      <View style={styles.actions}>
                        <CardIconButton symbol="pencil" label={`Edit ${sub}`} onPress={notAvailable} />
                        <CardIconButton symbol="trash" label={`Delete ${sub}`} onPress={notAvailable} />
                      </View>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={notAvailable}
                  accessibilityRole="button"
                  accessibilityLabel={`Add subcategory to ${cat.category}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.addSub, { opacity: pressed ? 0.6 : 1 }]}>
                  <SymbolView name="plus" size={13} tintColor={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" style={styles.addSubLabel}>
                    Add subcategory
                  </ThemedText>
                </Pressable>
              </Card>
            ))}
          </View>
        </View>
      ))}

      <OutlineButton label="Add New Category" onPress={notAvailable} />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    // Web `gap-3` between a section's heading and its cards.
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  cards: {
    gap: Layout.stackGap,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.iconButton,
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryName: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  subName: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: 999,
  },
  badgeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  addSub: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  addSubLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
