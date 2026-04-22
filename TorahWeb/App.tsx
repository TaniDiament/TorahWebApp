import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ContentScreen from './src/screens/ContentScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import { Article, Author, Content, ContentType, Topic } from './src/types';
import { colors, liquidGlass, radii, spacing, typography } from './src/theme';
import { GlassButton, GlassSurface } from './src/components/ui/Glass';
import { AudioPlayerProvider, useAudioPlayer } from './src/audio/AudioPlayerProvider';

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
  | { name: 'content'; content: Content }
  | { name: 'downloads' };

const AppShell = () => {
  const { currentTrack, expand } = useAudioPlayer();
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
  const openDownloads = () => push({ name: 'downloads' });
  const openRootSearch = () => setStack([{ name: 'search', title: 'Search TorahWeb' }]);
  const openRootDownloads = () => setStack([{ name: 'downloads' }]);

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
              : current.name === 'downloads'
                ? 'Downloads'
                : 'TorahWeb'}
          </Text>
          <View style={styles.headerActions}>
            <GlassButton style={styles.homeButton} contentStyle={styles.iconButtonInner} onPress={openDownloads}>
              <Text style={styles.homeButtonText}>↓</Text>
            </GlassButton>
            <GlassButton style={styles.homeButton} contentStyle={styles.iconButtonInner} onPress={reset}>
              <Text style={styles.homeButtonText}>⌂</Text>
            </GlassButton>
          </View>
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
            onDownloadsPress={openDownloads}
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
        {current.name === 'downloads' && <DownloadsScreen />}
      </View>
      <GlassSurface style={styles.bottomBar}>
        <GlassButton style={styles.tabButton} contentStyle={styles.tabButtonInner} onPress={reset}>
          <Text style={styles.tabLabel}>Home</Text>
        </GlassButton>
        <GlassButton
          style={styles.tabButton}
          contentStyle={styles.tabButtonInner}
          onPress={openRootSearch}>
          <Text style={styles.tabLabel}>Search</Text>
        </GlassButton>
        <GlassButton
          style={styles.tabButton}
          contentStyle={styles.tabButtonInner}
          onPress={openRootDownloads}>
          <Text style={styles.tabLabel}>Downloads</Text>
        </GlassButton>
        <GlassButton
          style={styles.tabButton}
          contentStyle={styles.tabButtonInner}
          onPress={expand}
          disabled={!currentTrack}>
          <Text style={styles.tabLabel}>Now Playing</Text>
        </GlassButton>
      </GlassSurface>
    </SafeAreaView>
  );
};

const App = () => (
  <AudioPlayerProvider>
    <AppShell />
  </AudioPlayerProvider>
);

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
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  homeButtonText: {
    color: liquidGlass.textOnGlass,
    fontSize: 22,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    paddingBottom: 74,
  },
  bottomBar: {
    ...liquidGlass.surface,
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    borderRadius: radii.pill,
  },
  tabButtonInner: {
    ...liquidGlass.button,
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tabLabel: {
    ...typography.caption,
    color: liquidGlass.textOnGlass,
    fontWeight: '700',
  },
});

export default App;
