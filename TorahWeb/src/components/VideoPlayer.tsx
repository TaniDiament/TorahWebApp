import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, liquidGlass, radii, typography } from '../theme';
import { GlassButton } from './ui/Glass';

interface VideoPlayerProps {
  vimeoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

const buildHtml = (embedUrl: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; }
      .wrap { position: relative; width: 100%; height: 100%; }
      iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <iframe
        src="${embedUrl}"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        webkitallowfullscreen
        mozallowfullscreen>
      </iframe>
    </div>
  </body>
</html>`;

const VideoPlayer: React.FC<VideoPlayerProps> = ({ vimeoId, videoUrl }) => {
  const [fallback, setFallback] = useState(false);

  const embedUrl = vimeoId
    ? `https://player.vimeo.com/video/${vimeoId}`
    : videoUrl ?? null;

  if (!embedUrl) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No video available for this shiur.</Text>
      </View>
    );
  }

  if (fallback) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Unable to load the embedded player.</Text>
        <GlassButton
          style={styles.openButton}
          contentStyle={styles.openButtonInner}
          onPress={() => Linking.openURL(embedUrl)}
        >
          <Text style={styles.openButtonText}>OPEN IN BROWSER</Text>
        </GlassButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        source={{ html: buildHtml(embedUrl) }}
        style={styles.webview}
        onError={() => setFallback(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    ...typography.body,
    color: colors.surface,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  openButton: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: radii.sm,
  },
  openButtonInner: {
    ...liquidGlass.button,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
  },
  openButtonText: {
    ...typography.eyebrow,
    color: liquidGlass.textOnGlass,
  },
});

export default VideoPlayer;
