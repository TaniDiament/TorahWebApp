import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, thumbnailUrl }) => {
  const [error, setError] = useState(false);

  const handlePlayVideo = async () => {
    try {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Error opening video:', err);
      setError(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🎥</Text>
        <TouchableOpacity style={styles.playButton} onPress={handlePlayVideo}>
          <Text style={styles.playButtonText}>▶ Play Video</Text>
        </TouchableOpacity>
        {error && (
          <Text style={styles.errorText}>
            Unable to load video player
          </Text>
        )}
      </View>
      <Text style={styles.note}>
        Note: Install react-native-video for embedded video playback
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    fontSize: 60,
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: 10,
    fontSize: 12,
  },
  note: {
    fontSize: 10,
    color: '#666',
    padding: 5,
    textAlign: 'center',
  },
});

export default VideoPlayer;

