import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, title }) => {
  const [error, setError] = useState(false);

  const handlePlayAudio = async () => {
    try {
      const supported = await Linking.canOpenURL(audioUrl);
      if (supported) {
        await Linking.openURL(audioUrl);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Error opening audio:', err);
      setError(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.playerContainer}>
        <Text style={styles.icon}>🎵</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.playButton} onPress={handlePlayAudio}>
            <Text style={styles.playButtonText}>▶</Text>
          </TouchableOpacity>
        </View>
        {error && (
          <Text style={styles.errorText}>
            Unable to load audio player
          </Text>
        )}
      </View>
      <Text style={styles.note}>
        Note: Install react-native-sound or react-native-track-player for embedded audio playback
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  playerContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  icon: {
    fontSize: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 24,
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
    marginTop: 10,
    textAlign: 'center',
  },
});

export default AudioPlayer;

