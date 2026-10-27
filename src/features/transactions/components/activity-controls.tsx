import { useRouter } from 'expo-router';
import { Search, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { PendingBanner } from '@/features/pending/components/pending-banner';
import { ViewTabs } from '@/features/transactions/components/view-tabs';
import { useTheme } from '@/hooks/use-theme';

type ActivityControlsProps = {
  value: 'month' | 'year';
  onChange: (value: 'month' | 'year') => void;
};

/**
 * The Activity header: Month/Year on the left, search on the right. Search and
 * filtering live together on the search screen. The pending-bank prompt sits
 * underneath when there is one.
 */
export function ActivityControls({ value, onChange }: ActivityControlsProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ViewTabs value={value} onChange={onChange} />
        <View style={styles.actions}>
          <IconButton
            icon={Search}
            label="Search transactions"
            onPress={() => router.push('/transactions/search')}
          />
        </View>
      </View>

      <PendingBanner />
    </View>
  );
}

function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.6 : 1,
        },
      ]}>
      <Icon size={18} color={theme.tint} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
