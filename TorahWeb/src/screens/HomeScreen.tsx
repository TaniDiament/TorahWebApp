import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Author, Topic } from '../types';
import { api } from '../services/api';
import AuthorButton from '../components/AuthorButton';
import TopicButton from '../components/TopicButton';

interface HomeScreenProps {
  onAuthorPress: (author: Author) => void;
  onTopicPress: (topic: Topic) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onAuthorPress, onTopicPress }) => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [authorsData, topicsData] = await Promise.all([
        api.getAuthors(),
        api.getTopics(),
      ]);
      setAuthors(authorsData);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>TorahWeb</Text>
        <Text style={styles.heroSubtitle}>
          Divrei Torah, videos, and events with special{'\n'}
          attention to contemporary religious and social issues
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore Our </Text>
          <Text style={styles.sectionTitleHighlight}>Authors</Text>
        </View>
        <View style={styles.buttonGrid}>
          {authors.map((author) => (
            <AuthorButton
              key={author.id}
              author={author}
              onPress={() => onAuthorPress(author)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse by </Text>
          <Text style={styles.sectionTitleHighlight}>Topics</Text>
        </View>
        <View style={styles.buttonGrid}>
          {topics.map((topic) => (
            <TopicButton
              key={topic.id}
              topic={topic}
              onPress={() => onTopicPress(topic)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  hero: {
    backgroundColor: '#1a3a5c',
    padding: 40,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 15,
    marginHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
  },
  sectionTitleHighlight: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a3a5c',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default HomeScreen;

