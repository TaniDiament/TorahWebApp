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

jest.mock('@react-native-community/blur', () => {
  const React = require('react');
  const { View } = require('react-native');

  const BlurView = React.forwardRef((props, ref) =>
    React.createElement(View, {
      ...props,
      ref,
    }),
  );

  return { BlurView };
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

  const GestureHandlerRootView = ({ children, style }) =>
    React.createElement(View, { style }, children);

  return {
    GestureHandlerRootView,
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

global.flushAsync = () => new Promise((resolve) => setImmediate(resolve));

