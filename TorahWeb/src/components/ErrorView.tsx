import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import Icon, { IconName } from './ui/Icon';

interface ErrorViewProps {
  title: string;
  message: string;
  icon?: IconName;
  onRetry?: () => void;
  retryLabel?: string;
}

// Full-height, centered error/empty state with an optional action button.
// Used by the data-loading screens (Home, Search, Content) so a failed fetch
// surfaces something actionable instead of a blank list or an endless spinner.
// Mirrors the visual language of the inline empty states already in the app
// (icon → title → message), and fills its parent via flex so it drops cleanly
// into both a full screen and a FlatList's ListEmptyComponent.
const ErrorView: React.FC<ErrorViewProps> = ({
  title,
  message,
  icon = 'exclamationmark.triangle',
  onRetry,
  retryLabel = 'Try Again',
}) => (
  <View style={styles.wrap}>
    <Icon name={icon} size={48} color={colors.textTertiary} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry ? (
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>{retryLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    ...typography.title3,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.subheadline,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.subheadline,
    color: colors.textInverse,
    fontWeight: '700',
  },
});

export default ErrorView;
