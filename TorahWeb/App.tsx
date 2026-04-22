import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ContentScreen from './src/screens/ContentScreen';
import { Article, Author, Content, ContentType, Topic } from './src/types';
import { colors, liquidGlass, radii, spacing, typography } from './src/theme';
import { GlassButton, GlassSurface } from './src/components/ui/Glass';

type Screen =
  | { name: 'home' }
  | {
      name: 'search';
      authorId?: string;
      topicSlug?: string;
      contentType?: ContentType;
      showAll?: boolean;
      title?: string;
    }
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
  const openAudio = () =>
    push({ name: 'search', contentType: 'audio', title: 'Audio' });
  const openVideo = () =>
    push({ name: 'search', contentType: 'video', title: 'Video' });
  const openNewest = () =>
    push({ name: 'search', showAll: true, title: 'Newest' });

  return (
    <SafeAreaView style={styles.container}>
      {current.name !== 'home' ? (
        <GlassSurface style={styles.header}>
          <GlassButton style={styles.backButton} contentStyle={styles.iconButtonInner} onPress={pop}>
            <Text style={styles.backButtonText}>←</Text>
          </GlassButton>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {current.name === 'search'
              ? current.title ?? 'Search'
              : 'TorahWeb'}
          </Text>
          <GlassButton style={styles.homeButton} contentStyle={styles.iconButtonInner} onPress={reset}>
            <Text style={styles.homeButtonText}>⌂</Text>
          </GlassButton>
        </GlassSurface>
      ) : null}

      <View style={styles.body}>
        {current.name === 'home' && (
          <HomeScreen
            onAuthorPress={openAuthor}
            onTopicPress={openTopic}
            onArticlePress={openArticle}
            onSearchPress={openSearch}
            onAudioPress={openAudio}
            onVideoPress={openVideo}
            onNewestPress={openNewest}
          />
        )}
        {current.name === 'search' && (
          <SearchScreen
            initialAuthorId={current.authorId}
            initialTopicSlug={current.topicSlug}
            initialContentType={current.contentType}
            showAllOnMount={current.showAll}
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
    paddingHorizontal: spacing.md,
    ...liquidGlass.header,
  },
  backButton: {
    borderRadius: radii.pill,
  },
  iconButtonInner: {
    ...liquidGlass.button,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  backButtonText: {
    color: liquidGlass.textOnGlass,
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 28,
  },
  headerTitle: {
    flex: 1,
    ...typography.cardTitle,
    color: liquidGlass.textOnGlass,
    textAlign: 'center',
  },
  homeButton: {
    borderRadius: radii.pill,
  },
  homeButtonText: {
    color: liquidGlass.textOnGlass,
    fontSize: 22,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
});

export default App;
