import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme';
import { AudioPlayerProvider } from './src/audio/AudioPlayerProvider';
import OfflineBanner from './src/components/OfflineBanner';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';

const Shell: React.FC = () => {
  const c = useTheme();
  const scheme = useColorScheme();
  return (
    <AudioPlayerProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: c.background }]}
        edges={['top']}>
        <OfflineBanner />
        <View style={styles.body}>
          <AppNavigator />
        </View>
      </SafeAreaView>
    </AudioPlayerProvider>
  );
};

// ErrorBoundary sits outside ThemeProvider so its crash fallback never depends
// on context (it renders the static light palette — acceptable for a rare
// last-resort screen).
const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});

export default App;
