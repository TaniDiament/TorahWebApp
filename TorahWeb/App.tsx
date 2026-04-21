import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ContentScreen from './src/screens/ContentScreen';
import { Article, Author, Content, Topic } from './src/types';
import { colors, spacing, typography } from './src/theme';

type Screen =
  | { name: 'home' }
  | { name: 'search'; authorId?: string; topicSlug?: string; title?: string }
  | { name: 'content'; content: Content };

const App = () => {
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);

  const current = stack[stack.length - 1];
  const push = (s: Screen) => setStack((prev) => [...prev, s]);
  const pop = () =>
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const reset = () => setStack([{ name: 'home' }]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const openAuthor = (author: Author) =>
    push({ name: 'search', authorId: author.id, title: author.name });
  const openTopic = (topic: Topic) =>
    push({ name: 'search', topicSlug: topic.slug, title: topic.name });
  const openArticle = (article: Article) => push({ name: 'content', content: article });
  const openContent = (content: Content) => push({ name: 'content', content });
  const openSearch = () => push({ name: 'search', title: 'Search TorahWeb' });

  return (
    <SafeAreaView style={styles.container}>
      {current.name !== 'home' ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={pop} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {current.name === 'search'
              ? current.title ?? 'Search'
              : 'TorahWeb'}
          </Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={reset}
            activeOpacity={0.7}>
            <Text style={styles.homeButtonText}>⌂</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.body}>
        {current.name === 'home' && (
          <HomeScreen
            onAuthorPress={openAuthor}
            onTopicPress={openTopic}
            onArticlePress={openArticle}
            onSearchPress={openSearch}
          />
        )}
        {current.name === 'search' && (
          <SearchScreen
            initialAuthorId={current.authorId}
            initialTopicSlug={current.topicSlug}
            headerTitle={current.title}
            onContentSelect={openContent}
          />
        )}
        {current.name === 'content' && <ContentScreen content={current.content} />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 28,
  },
  headerTitle: {
    flex: 1,
    ...typography.cardTitle,
    color: colors.surface,
    textAlign: 'center',
  },
  homeButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  homeButtonText: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
});

export default App;
