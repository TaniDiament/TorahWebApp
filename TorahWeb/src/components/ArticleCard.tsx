import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Content, Article, Video, Audio } from '../types';

interface ArticleCardProps {
  content: Content;
  onPress: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ content, onPress }) => {
  const getContentType = () => {
    if ('content' in content) return '📄 Article';
    if ('videoUrl' in content) return '🎥 Video';
    if ('audioUrl' in content) return '🎵 Audio';
    return '';
  };

  const getContentIcon = () => {
    if ('content' in content) return '📄';
    if ('videoUrl' in content) return '🎥';
    if ('audioUrl' in content) return '🎵';
    return '📄';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{getContentIcon()}</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.typeLabel}>{getContentType()}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {content.title}
        </Text>
        <Text style={styles.author}>{content.author.name}</Text>
        {content.topics && content.topics.length > 0 && (
          <View style={styles.topicsContainer}>
            {content.topics.slice(0, 2).map((topic) => (
              <View key={topic.id} style={styles.topicTag}>
                <Text style={styles.topicText}>{topic.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#1a3a5c',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 26,
  },
  contentContainer: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 12,
    color: '#1a3a5c',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a3a5c',
    marginBottom: 6,
    lineHeight: 24,
  },
  author: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topicTag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  topicText: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '500',
  },
});

export default ArticleCard;

