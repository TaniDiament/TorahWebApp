/* eslint-env jest */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const WebView = React.forwardRef((props, ref) =>
    React.createElement(View, {
      ...props,
      ref,
    }),
  );

  return { WebView };
});

jest.mock('./src/components/ui/TorahWebLiquidGlassViewNativeComponent', () => {
  const React = require('react');
  const { View } = require('react-native');

  const LiquidGlass = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }),
  );

  return { __esModule: true, default: LiquidGlass };
});


jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: {
        DocumentDir: '/tmp',
        DownloadDir: '/tmp',
      },
      exists: jest.fn(() => Promise.resolve(false)),
      readFile: jest.fn(() => Promise.resolve('[]')),
      writeFile: jest.fn(() => Promise.resolve()),
      unlink: jest.fn(() => Promise.resolve()),
    },
    android: {
      actionViewIntent: jest.fn(() => Promise.resolve()),
    },
    config: jest.fn(() => ({
      fetch: jest.fn(() => Promise.resolve()),
    })),
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  const passthrough = ({ children, style }) =>
    React.createElement(View, { style }, children);

  // Chainable no-op gesture builder so `Gesture.Pan().activeOffsetY(10)
  // .onEnd(fn)…` (AudioPlayerProvider) works without the native module. Every
  // configurator returns the same proxy, and the proxy is callable so
  // `Gesture.Pan()` resolves too.
  const makeChainable = () => {
    const proxy = new Proxy(function () {}, {
      get: () => () => proxy,
      apply: () => proxy,
    });
    return proxy;
  };
  const Gesture = new Proxy({}, { get: () => () => makeChainable() });

  return {
    GestureHandlerRootView: passthrough,
    GestureDetector: passthrough,
    Gesture,
  };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Swipeable = React.forwardRef(({ children }, ref) =>
    React.createElement(View, { ref }, children),
  );

  return Swipeable;
});

jest.mock('react-native-track-player', () => {
  const listeners = [];

  return {
    __esModule: true,
    default: {
      setupPlayer: jest.fn(() => Promise.resolve()),
      updateOptions: jest.fn(() => Promise.resolve()),
      reset: jest.fn(() => Promise.resolve()),
      add: jest.fn(() => Promise.resolve()),
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
      seekTo: jest.fn(() => Promise.resolve()),
      getState: jest.fn(() => Promise.resolve(2)),
      getPosition: jest.fn(() => Promise.resolve(0)),
      getDuration: jest.fn(() => Promise.resolve(0)),
      addEventListener: jest.fn((_event, handler) => {
        listeners.push(handler);
        return { remove: jest.fn() };
      }),
      registerPlaybackService: jest.fn(),
    },
    // Hook consumed by AudioPlayerProvider on every render.
    useProgress: () => ({ position: 0, duration: 0, buffered: 0 }),
    Event: {
      PlaybackState: 'playback-state',
      RemotePlay: 'remote-play',
      RemotePause: 'remote-pause',
      RemoteStop: 'remote-stop',
      RemoteSeek: 'remote-seek',
      RemoteJumpForward: 'remote-forward',
      RemoteJumpBackward: 'remote-backward',
    },
    State: {
      Playing: 3,
    },
    Capability: {
      Play: 'play',
      Pause: 'pause',
      Stop: 'stop',
      SeekTo: 'seekTo',
      JumpForward: 'jumpForward',
      JumpBackward: 'jumpBackward',
    },
    AppKilledPlaybackBehavior: {
      StopPlaybackAndRemoveNotification: 'stop-playback-and-remove-notification',
    },
  };
});

// VolumeManager touches a native module at import time; mock the slice the
// Now Playing volume slider uses (read/set + change subscription + HUD toggle).
jest.mock('react-native-volume-manager', () => ({
  __esModule: true,
  VolumeManager: {
    getVolume: jest.fn(() => Promise.resolve({ volume: 0.5 })),
    setVolume: jest.fn(() => Promise.resolve()),
    addVolumeListener: jest.fn(() => ({ remove: jest.fn() })),
    showNativeVolumeUI: jest.fn(() => Promise.resolve()),
  },
}));

// NetInfo touches NativeModules.RNCNetInfo at import time, which is null under
// Jest — mock the slice OfflineBanner uses (event subscription + one-shot fetch).
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
}));

global.flushAsync = () => new Promise((resolve) => setImmediate(resolve));

