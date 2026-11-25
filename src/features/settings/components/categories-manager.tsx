import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Card, CardIconButton } from '@/components/card';
import { CategoryGlyph } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Layout, Spacing } from '@/constants/theme';
import { useCategories } from '@/features/categories/use-categories';
import type { CategoryEntry } from '@/features/categories/registry';
import {
  categorySections,
  categoryTransactionCount,
  subcategoryTransactionCount,
} from '@/features/settings/category-sections';
import { useCategoryCounts } from '@/features/settings/use-category-counts';
import { useTheme } from '@/hooks/use-theme';

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
 * Settings → Categories: the categories under Income / Expenses / Movements tabs,
 * each with its subcategories (built-in and custom) and a transaction count.
 * The pencils open an edit sheet; adding is the floating + on the Settings
 * screen and "Add subcategory". Renaming and deleting are placeholders for now,
 * as on web.
 */
export function CategoriesManager() {
  const theme = useTheme();
  const router = useRouter();
  const { data: counts } = useCategoryCounts();
  // Re-renders when custom categories load; `categorySections` reads them.
  const { categories } = useCategories();
  const sections = categorySections();
  const [sectionTitle, setSectionTitle] = useState(sections[0].title);
  const section = sections.find((candidate) => candidate.title === sectionTitle) ?? sections[0];

  const openEdit = (cat: CategoryEntry, sub?: string) =>
    router.push({
      pathname: '/category/edit',
      params: { category: cat.category, type: cat.type, ...(sub ? { sub } : {}) },
    });

  return (
    <>
      <View style={styles.tabs} accessibilityRole="tablist">
        {sections.map((option) => {
          const selected = option.title === section.title;
          return (
            <Pressable
              key={option.title}
              onPress={() => setSectionTitle(option.title)}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected }}>
              <ThemedText themeColor={selected ? 'text' : 'textSecondary'} style={styles.sectionTitle}>
                {option.title}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.cards}>
        {section.categories.map((cat) => (
          <Card key={`${cat.type}/${cat.category}`}>
            <View style={styles.head}>
              <View style={styles.title}>
                <CategoryGlyph category={cat.category} size={20} color={theme.textSecondary} />
                <ThemedText style={styles.categoryName}>{cat.category}</ThemedText>
                <CountBadge count={categoryTransactionCount(counts, categories, cat)} />
              </View>
              <CardIconButton
                symbol="pencil"
                label={`Edit ${cat.category}`}
                onPress={() => openEdit(cat)}
              />
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
                    <CountBadge count={subcategoryTransactionCount(counts, categories, cat, sub)} />
                  </View>
                  <CardIconButton
                    symbol="pencil"
                    label={`Edit ${sub}`}
                    onPress={() => openEdit(cat, sub)}
                  />
                </View>
              ))}
            </View>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/category/new',
                  params: { parent: cat.category, type: cat.type },
                })
              }
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
    </>
  );
}

const styles = StyleSheet.create({
  // The section tabs: Income / Expenses / Movements, in the heading style.
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
