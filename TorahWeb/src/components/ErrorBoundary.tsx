import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// App-wide safety net: a render-time exception anywhere below this boundary is
// caught here instead of unmounting the whole React tree to a blank screen.
//
// The fallback is intentionally dependency-light — plain View / Text / Pressable
// and the static theme, with no Icon, Glass, navigation, or data access — so it
// can't itself throw. React does NOT catch errors thrown by an error boundary's
// own fallback; such an error would propagate past this boundary and crash the
// app, defeating the purpose. Keep this render trivially safe.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No crash-reporting backend wired up yet; log so it surfaces in dev and
    // in `adb logcat` / Console on a device build.
    console.error('Uncaught render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. Tap below to try again — if it keeps
          happening, fully close and reopen the app.
        </Text>
        <Pressable
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title2,
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

export default ErrorBoundary;
