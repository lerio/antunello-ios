import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { validateNewPassword } from '@/features/auth/password';
import { messageOf } from '@/lib/errors';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sets a new password for the signed-in user.
 *
 * The web app's reset-password page does the same: two fields, a match check,
 * then `updateUser`. The signed-in session is the credential, so the current
 * password is not asked for.
 */
export function ChangePasswordForm() {
  const theme = useTheme();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = password.length > 0 && confirmPassword.length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    const validationError = validateNewPassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      hapticError();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(messageOf(updateError));
      hapticError();
      return;
    }

    hapticSuccess();
    Alert.alert('Password updated', 'Your password has been changed.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.fields}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              editable={!isSubmitting}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              editable={!isSubmitting}
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error ? (
            <ThemedText themeColor="destructive" accessibilityRole="alert">
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
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.buttonLabel}>Update password</ThemedText>
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
    padding: Spacing.four,
    gap: Spacing.three,
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
  button: {
    height: 50,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
