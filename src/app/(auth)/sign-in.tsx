import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

/**
 * Email and password sign-in.
 *
 * The web app has no sign-up screen — the account is created elsewhere — so
 * neither does this.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);

    // On success the auth state change unmounts this screen, so there is
    // nothing to navigate to — only the failure path needs handling.
    if (signInError) {
      setError(signInError);
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.six }]}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Antunello</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Sign in to your account
          </ThemedText>

          <View style={styles.fields}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              editable={!isSubmitting}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              editable={!isSubmitting}
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error} accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.tint, opacity: !canSubmit ? 0.4 : pressed ? 0.8 : 1 },
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color={theme.onTint} />
            ) : (
              <ThemedText style={[styles.buttonLabel, { color: theme.onTint }]}>
                Sign in
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  tagline: {
    marginBottom: Spacing.four,
  },
  fields: {
    gap: Spacing.three,
  },
  input: {
    height: 50,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 17,
  },
  error: {
    marginTop: Spacing.three,
  },
  button: {
    height: 50,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  buttonLabel: {
    fontWeight: '600',
  },
});
