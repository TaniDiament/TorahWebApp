import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Content, Article, Video, Audio } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';

interface ContentScreenProps {
  content: Content;
}

const ContentScreen: React.FC<ContentScreenProps> = ({ content }) => {
  const isArticle = (content: Content): content is Article => {
    return 'content' in content;
  };

  const isVideo = (content: Content): content is Video => {
    return 'videoUrl' in content;
  };

  const isAudio = (content: Content): content is Audio => {
    return 'audioUrl' in content && !('videoUrl' in content);
  };

  const renderContent = () => {
    if (isVideo(content)) {
      return (
        <View>
          <VideoPlayer videoUrl={content.videoUrl} thumbnailUrl={content.thumbnailUrl} />
          {content.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{content.description}</Text>
            </View>
          )}
        </View>
      );
    }

    if (isAudio(content)) {
      return (
        <View>
          <AudioPlayer audioUrl={content.audioUrl} title={content.title} />
          {content.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{content.description}</Text>
            </View>
          )}
        </View>
      );
    }

    if (isArticle(content)) {
      return (
        <View style={styles.articleContainer}>
          {content.excerpt && (
            <Text style={styles.excerpt}>{content.excerpt}</Text>
          )}
          <Text style={styles.articleContent}>{content.content}</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.author}>By {content.author.name}</Text>
        <Text style={styles.date}>
          {new Date(content.publishedDate).toLocaleDateString()}
        </Text>
      </View>

      {content.topics && content.topics.length > 0 && (
        <View style={styles.topicsContainer}>
          {content.topics.map((topic) => (
            <View key={topic.id} style={styles.topicTag}>
              <Text style={styles.topicText}>{topic.name}</Text>
            </View>
          ))}
        </View>
      )}

      {renderContent()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 24,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 2,
    borderBottomColor: '#1a3a5c',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a3a5c',
    marginBottom: 12,
    lineHeight: 34,
  },
  author: {
    fontSize: 17,
    color: '#1a3a5c',
    marginBottom: 6,
    fontWeight: '600',
  },
  date: {
    fontSize: 14,
    color: '#666666',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  topicTag: {
    backgroundColor: '#1a3a5c',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 4,
    marginRight: 10,
    marginBottom: 10,
  },
  topicText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  articleContainer: {
    padding: 24,
  },
  excerpt: {
    fontSize: 17,
    fontStyle: 'italic',
    color: '#555555',
    marginBottom: 24,
    paddingLeft: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1a3a5c',
    lineHeight: 26,
  },
  articleContent: {
    fontSize: 17,
    lineHeight: 28,
    color: '#333333',
  },
  descriptionContainer: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
});

export default ContentScreen;

