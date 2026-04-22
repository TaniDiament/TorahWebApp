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

