import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Temporary scaffolding for a tab that has not been built yet.
 *
 * Names the screen and the phase that will fill it, so the running app doubles
 * as a build checklist. Delete each usage as its screen lands.
 */
export function PlaceholderScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <Screen style={styles.container}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{detail}</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
