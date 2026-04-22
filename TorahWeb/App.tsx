import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ContentScreen from './src/screens/ContentScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import { Article, Author, Content, ContentType, Topic } from './src/types';
import { colors, radii, spacing, typography } from './src/theme';
import { GlassButton, GlassSurface } from './src/components/ui/Glass';
import Icon, { IconName } from './src/components/ui/Icon';
import { AudioPlayerProvider } from './src/audio/AudioPlayerProvider';

type Tab = 'home' | 'search' | 'library';

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
  | { name: 'library' };

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_BOTTOM_OFFSET = 14;

const AppShell = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [stacks, setStacks] = useState<Record<Tab, Screen[]>>({
    home: [{ name: 'home' }],
    search: [{ name: 'search', title: 'Search' }],
    library: [{ name: 'library' }],
  });

  const stack = stacks[activeTab];
  const current = stack[stack.length - 1];

  const push = (s: Screen) =>
    setStacks((prev) => ({ ...prev, [activeTab]: [...prev[activeTab], s] }));
  const pop = () =>
    setStacks((prev) => {
      const cur = prev[activeTab];
      if (cur.length <= 1) return prev;
      return { ...prev, [activeTab]: cur.slice(0, -1) };
    });
  const resetTab = (tab: Tab) =>
    setStacks((prev) => ({ ...prev, [tab]: [prev[tab][0]] }));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, activeTab]);

  const openAuthor = (author: Author) =>
    push({ name: 'search', authorId: author.id, title: author.name });
  const openTopic = (topic: Topic) =>
    push({ name: 'search', topicSlug: topic.slug, title: topic.name });
  const openArticle = (article: Article) => push({ name: 'content', content: article });
  const openContent = (content: Content) => push({ name: 'content', content });
  const openSearch = () => {
    setActiveTab('search');
    resetTab('search');
  };
  const openAudio = () =>
    push({ name: 'search', contentType: 'audio', title: 'Audio' });
  const openVideo = () =>
    push({ name: 'search', contentType: 'video', title: 'Video' });
  const openNewest = () =>
    push({ name: 'search', showAll: true, title: 'Newest' });
  const openLibrary = () => {
    setActiveTab('library');
    resetTab('library');
  };

  const onTabPress = (tab: Tab) => {
    if (tab === activeTab) {
      resetTab(tab);
      return;
    }
    setActiveTab(tab);
  };

  const showBackButton = stack.length > 1;
  const headerTitle = useMemo(() => {
    if (current.name === 'home') return null;
    if (current.name === 'search') return current.title ?? 'Search';
    if (current.name === 'library') return 'Library';
    return '';
  }, [current]);

  const bodyBottomPadding = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET + Math.max(insets.bottom, 8) + 12;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {showBackButton ? (
        <View style={styles.floatingBackWrap} pointerEvents="box-none">
          <GlassButton
            style={styles.floatingBack}
            contentStyle={styles.floatingBackInner}
            cornerRadius={radii.pill}
            variant="regular"
            onPress={pop}>
            <Icon name="chevron.left" size={22} color={colors.text} />
          </GlassButton>
          {headerTitle ? (
            <View style={styles.floatingTitleWrap} pointerEvents="none">
              <GlassSurface
                variant="regular"
                cornerRadius={radii.pill}
                style={styles.floatingTitle}>
                <Text numberOfLines={1} style={styles.floatingTitleText}>
                  {headerTitle}
                </Text>
              </GlassSurface>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.body, { paddingBottom: bodyBottomPadding }]}>
        {current.name === 'home' && (
          <HomeScreen
            onAuthorPress={openAuthor}
            onTopicPress={openTopic}
            onArticlePress={openArticle}
            onSearchPress={openSearch}
            onAudioPress={openAudio}
            onVideoPress={openVideo}
            onNewestPress={openNewest}
            onDownloadsPress={openLibrary}
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
        {current.name === 'library' && <DownloadsScreen />}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.tabBarWrap,
          { bottom: TAB_BAR_BOTTOM_OFFSET + Math.max(insets.bottom, 8) },
        ]}>
        <GlassSurface
          variant="prominent"
          cornerRadius={radii.pill}
          style={styles.tabBar}>
          <TabItem label="Home" icon="house.fill" active={activeTab === 'home'} onPress={() => onTabPress('home')} />
          <TabItem label="Search" icon="magnifyingglass" active={activeTab === 'search'} onPress={() => onTabPress('search')} />
          <TabItem label="Library" icon="rectangle.stack.fill" active={activeTab === 'library'} onPress={() => onTabPress('library')} />
        </GlassSurface>
      </View>
    </SafeAreaView>
  );
};

const TabItem: React.FC<{
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}> = ({ label, icon, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.tabItem,
      pressed && { opacity: 0.7 },
    ]}>
    <Icon name={icon} size={22} color={active ? colors.navy : colors.textTertiary} />
    <Text
      style={[
        styles.tabLabel,
        { color: active ? colors.navy : colors.textTertiary },
      ]}>
      {label}
    </Text>
  </Pressable>
);

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
  body: {
    flex: 1,
  },
  floatingBackWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 16,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  floatingBack: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
  },
  floatingBackInner: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    paddingHorizontal: spacing.lg,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    maxWidth: '70%',
  },
  floatingTitleText: {
    ...typography.headline,
    color: colors.text,
  },
  tabBarWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radii.pill,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});

export default App;
