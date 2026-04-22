/**
 * @format
 */

import 'react-native-gesture-handler';
import React from 'react';
import { AppRegistry } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { name as appName } from './app.json';

const AppWrapper = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

AppRegistry.registerComponent(appName, () => AppWrapper);
TrackPlayer.registerPlaybackService(() => require('./src/audio/playbackService').default);
