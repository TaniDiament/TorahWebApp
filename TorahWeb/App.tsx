import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import { AudioPlayerProvider } from './src/audio/AudioPlayerProvider';
import OfflineBanner from './src/components/OfflineBanner';
import AppNavigator from './src/navigation/AppNavigator';

const App: React.FC = () => (
  <AudioPlayerProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineBanner />
      <View style={styles.body}>
        <AppNavigator />
      </View>
    </SafeAreaView>
  </AudioPlayerProvider>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
});

export default App;
