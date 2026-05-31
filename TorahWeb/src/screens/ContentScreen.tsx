import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import RenderHTML, {
  type MixedStyleDeclaration,
  type MixedStyleRecord,
} from 'react-native-render-html';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Content, isArticle, isAudio, isVideo } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import AudioPlayer from '../components/AudioPlayer';
import { Palette, radii, shadows, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import ErrorView from '../components/ErrorView';
import { api } from '../services/api';
import { canDownloadContent } from '../services/download';
import { useDownloads } from '../downloads/DownloadsProvider';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { contentShareUrl, resolveInternalLink } from '../navigation/links';
import { useScreenChromeInsets } from '../navigation/chromeInsets';

// Content screens are registered in every per-tab stack with the same
// route name and the same params shape — typing against the HomeStack's
// "Content" route is sufficient at the call sites because the param shape
// is identical across stacks.
type ContentRoute = RouteProp<HomeStackParamList, 'Content'>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const ContentScreen: React.FC = () => {
  const route = useRoute<ContentRoute>();
  const navigation = useNavigation();
  const chrome = useScreenChromeInsets();
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = route.params;
  const [content, setContent] = useState<Content | null>(
    'content' in params ? params.content : null,
  );
  // Deep-link fetch outcome when `content` is still null: 'error' is a
  // network/throw (retryable), 'missing' is a 404/null (the item is gone).
  const [loadFailed, setLoadFailed] = useState<'error' | 'missing' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { items, activeDownloads, startDownload } = useDownloads();

  // Links inside an article body: keep torahweb.org section links (e.g. the
  // trailing "More divrei Torah on Special Topics") inside the app, and send
  // everything else to the system browser. ContentScreen sits in several tab
  // stacks, so we hop through the parent tab navigator (Search / Home) — the
  // only navigator guaranteed to reach those list/menu screens from here.
  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_event: unknown, href: string) => {
          const link = resolveInternalLink(href);
          const parent =
            navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
          if (link && parent) {
            switch (link.kind) {
              case 'topic':
                parent.navigate('SearchTab', {
                  screen: 'SearchRoot',
                  params: { topicSlug: link.slug, title: link.title },
                });
                return;
              case 'author':
                parent.navigate('SearchTab', {
                  screen: 'SearchRoot',
                  params: { authorId: link.authorId },
                });
                return;
              case 'yomtov':
                parent.navigate('HomeTab', {
                  screen: 'Menu',
                  params: { menu: 'yomtov', title: 'Yom Tov' },
                });
                return;
              case 'parsha':
                parent.navigate('HomeTab', {
                  screen: 'Menu',
                  params: { menu: 'parshaBooks', title: 'Parsha' },
                });
                return;
            }
          }
          // External link (or nothing we can route): open in the browser.
          Linking.openURL(href).catch(() => {
            // Silently ignore — the user can long-press to copy if they want.
          });
        },
      },
    }),
    [navigation],
  );

  // Deep-link entry: only an id + kind are in the URL, so resolve the full
  // record via the provider. In-app pushes carry the hydrated Content and
  // skip this branch entirely.
  useEffect(() => {
    if (content) return;
    if (!('contentId' in params)) return;
    let cancelled = false;
    setLoadFailed(null);
    (async () => {
      try {
        const { contentId, contentKind } = params;
        const fetched =
          contentKind === 'article'
            ? await api.getArticle(contentId)
            : contentKind === 'video'
              ? await api.getVideo(contentId)
              : await api.getAudio(contentId);
        if (cancelled) return;
        // A null result is a 404 / removed item — distinct from a thrown
        // network error so we can show the right message and skip a pointless
        // retry on something that no longer exists.
        if (fetched) setContent(fetched);
        else setLoadFailed('missing');
      } catch (err) {
        if (cancelled) return;
        console.error('ContentScreen load failed:', err);
        setLoadFailed('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, params, reloadKey]);

  if (!content) {
    if (loadFailed) {
      const isMissing = loadFailed === 'missing';
      const canGoBack = navigation.canGoBack();
      return (
        <View style={styles.loadingWrap}>
          <ErrorView
            icon={isMissing ? 'exclamationmark.triangle' : 'wifi.slash'}
            title={isMissing ? 'Not available' : "Couldn't load"}
            message={
              isMissing
                ? "This item isn't available anymore."
                : 'Check your connection and try again.'
            }
            // 404s won't recover on retry, so offer a way out instead. A
            // network error is retryable in place.
            onRetry={
              isMissing
                ? canGoBack
                  ? () => navigation.goBack()
                  : undefined
                : () => setReloadKey((k) => k + 1)
            }
            retryLabel={isMissing ? 'Go Back' : 'Try Again'}
          />
        </View>
      );
    }
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const showDownload = canDownloadContent(content);
  const artwork = content.author.portraitUrl;

  // Reflect the live download state on the button: already on disk, fetching
  // right now, or available to start.
  const isDownloaded = items.some((entry) => entry.contentId === content.id);
  const isDownloading = activeDownloads.some(
    (entry) => entry.contentId === content.id && entry.status === 'downloading',
  );

  // Jump straight to the Library tab (its root list). ContentScreen lives in
  // several tab stacks, so we hop through the parent tab navigator — the same
  // pattern the in-article link router uses below.
  const goToLibrary = () => {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate('LibraryTab', { screen: 'Library' });
  };

  // Apple-Podcasts behavior: tapping download kicks off the fetch and takes the
  // user straight to the Library, where the item shows a live progress ring. If
  // it's already downloaded or in flight, just show them where it is.
  const onDownload = () => {
    if (!showDownload) return;
    if (!isDownloaded && !isDownloading) {
      startDownload(content);
    }
    goToLibrary();
  };

  const onShare = async () => {
    // Always share the canonical torahweb.org/content/<kind>/<id> link: it
    // deep-links straight back into the app on a recipient's phone (Universal
    // Link / App Link) and falls through to a web preview+redirect page for
    // anyone without the app installed.
    const target = contentShareUrl(content);
    const message = `${content.title}\n${content.author.name}\n\n${target}`;
    try {
      // `url` is iOS-only; on Android the share-sheet reads `message`. We
      // include both so iOS recipients get a previewable link attachment
      // and Android still ships the URL in-line.
      await Share.share({
        title: content.title,
        message,
        url: target,
      });
    } catch {
      // User dismissed the sheet or the platform rejected the payload —
      // nothing actionable to surface.
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: chrome.top, paddingBottom: chrome.bottom },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.heroBlock}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}

        <Text style={styles.eyebrow}>
          {isArticle(content) ? (content.parshaLabel ?? 'DIVREI TORAH') : isVideo(content) ? 'VIDEO' : 'AUDIO'}
        </Text>
        <Text selectable style={styles.title}>{content.title}</Text>
        <Text selectable style={styles.author}>{content.author.name}</Text>
        <Text style={styles.date}>{formatDate(content.publishedDate)}</Text>

        <View style={styles.actionRow}>
          {isAudio(content) ? (
            <AudioPlayer
              audioId={content.id}
              audioUrl={content.audioUrl}
              title={content.title}
              authorName={content.author.name}
              artworkUrl={content.author.portraitUrl}
              shareUrl={contentShareUrl(content)}
            />
          ) : null}
          {showDownload ? (
            <GlassButton
              style={styles.downloadButton}
              contentStyle={styles.downloadButtonInner}
              cornerRadius={radii.pill}
              tint={c.navy}
              accessibilityRole="button"
              accessibilityLabel={
                isDownloaded
                  ? `${content.title} in Library`
                  : isDownloading
                    ? 'Downloading'
                    : `Download ${content.title}`
              }
              accessibilityState={{ busy: isDownloading }}
              onPress={onDownload}>
              <Icon
                name={isDownloaded ? 'checkmark' : 'arrow.down.circle.fill'}
                size={18}
                color={c.textInverse}
              />
              <Text style={styles.downloadText}>
                {isDownloaded ? 'In Library' : isDownloading ? 'Downloading…' : 'Download'}
              </Text>
            </GlassButton>
          ) : null}
          <GlassButton
            style={styles.shareButton}
            contentStyle={styles.shareButtonInner}
            cornerRadius={radii.pill}
            variant="regular"
            accessibilityRole="button"
            accessibilityLabel={`Share ${content.title}`}
            onPress={onShare}>
            <Icon name="square.and.arrow.up" size={18} color={c.text} />
          </GlassButton>
        </View>
      </View>

      {isVideo(content) ? (
        <View style={styles.playerWrap}>
          <VideoPlayer
            vimeoId={content.vimeoId}
            videoUrl={content.videoUrl}
            thumbnailUrl={content.thumbnailUrl}
          />
          {content.description ? (
            <Text style={styles.body}>{content.description}</Text>
          ) : null}
        </View>
      ) : null}

      {isAudio(content) && content.description ? (
        <View style={styles.playerWrap}>
          <Text style={styles.body}>{content.description}</Text>
        </View>
      ) : null}

      {isArticle(content) ? (
        <View style={styles.articleBody}>
          <ArticleHtml html={content.content} renderersProps={renderersProps} />
        </View>
      ) : null}

      {content.topics.length > 0 ? (
        <View style={styles.topicsSection}>
          <Text style={styles.topicsHeading}>Topics</Text>
          <View style={styles.topicsRow}>
            {content.topics.map((t) => (
              <View key={t.id} style={styles.topicChip}>
                <Text style={styles.topicChipText}>{t.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

// Render the article body's sanitized HTML (per BACKEND_SCHEMA.md). Tag
// styles are kept as plain MixedStyleDeclaration objects so they survive
// react-native-render-html's style merger without the fontWeight / number
// typing pitfalls that `StyleSheet.create` introduces.
const makeHtmlStyles = (c: Palette): MixedStyleRecord => ({
  body: {
    color: c.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.fontWeight,
    letterSpacing: typography.body.letterSpacing,
  },
  p: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  strong: { fontWeight: '700' },
  b: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  i: { fontStyle: 'italic' },
  h1: {
    ...(typography.title1 as MixedStyleDeclaration),
    color: c.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h2: {
    ...(typography.title2 as MixedStyleDeclaration),
    color: c.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h3: {
    ...(typography.title3 as MixedStyleDeclaration),
    color: c.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    paddingLeft: spacing.md,
    marginVertical: spacing.md,
    color: c.textSecondary,
    fontStyle: 'italic',
  },
  ul: { marginTop: 0, marginBottom: spacing.md, paddingLeft: spacing.lg },
  ol: { marginTop: 0, marginBottom: spacing.md, paddingLeft: spacing.lg },
  li: { marginBottom: spacing.xs },
  a: { color: c.accent, textDecorationLine: 'underline' },
});

const ARTICLE_BODY_HPADDING = spacing.lg;

type RenderHTMLRenderersProps = React.ComponentProps<typeof RenderHTML>['renderersProps'];

const ArticleHtml: React.FC<{
  html: string;
  // `<a>` tap routing is owned by ContentScreen (it has the navigation ref);
  // ArticleHtml just forwards it to RenderHTML.
  renderersProps: RenderHTMLRenderersProps;
}> = ({ html, renderersProps }) => {
  const c = useTheme();
  const { width } = useWindowDimensions();
  // articleBody sits inside the screen's horizontal padding (spacing.lg
  // on each side). RenderHTML needs the *interior* width to size images
  // and inline content correctly.
  const contentWidth = useMemo(
    () => Math.max(0, width - ARTICLE_BODY_HPADDING * 2),
    [width],
  );
  const source = useMemo(() => ({ html }), [html]);
  const tagsStyles = useMemo(() => makeHtmlStyles(c), [c]);
  return (
    <RenderHTML
      contentWidth={contentWidth}
      source={source}
      tagsStyles={tagsStyles}
      renderersProps={renderersProps}
      defaultTextProps={{ selectable: true }}
      // The server sanitizes content before publishing; these are belt-and-
      // suspenders blocks against anything that slipped through. Iframes
      // and scripts have no business in an article body.
      ignoredDomTags={['script', 'iframe', 'object', 'embed', 'style']}
      enableExperimentalMarginCollapsing
    />
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  scrollContent: {
    // paddingTop / paddingBottom set at runtime from useScreenChromeInsets.
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  artwork: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: c.navyDark,
    marginBottom: spacing.xl,
    ...shadows.elevated,
  },
  artworkPlaceholder: {
    backgroundColor: c.navy,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: c.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title1,
    color: c.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  author: {
    ...typography.headline,
    color: c.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    ...typography.subheadline,
    color: c.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  // Both buttons render at the same height (40 px) so the row reads as a
  // single control cluster. `alignItems: stretch` on the row + matching
  // contentStyle height keeps the Download pill and Share circle aligned
  // even when the icon/text content differs.
  downloadButton: {
    borderRadius: radii.pill,
  },
  downloadButtonInner: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.pill,
  },
  downloadText: {
    ...typography.subheadline,
    color: c.textInverse,
    fontWeight: '700',
  },
  shareButton: {
    borderRadius: radii.pill,
  },
  shareButtonInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  playerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  articleBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  body: {
    ...typography.body,
    color: c.text,
    marginTop: spacing.md,
  },
  topicsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  topicsHeading: {
    ...typography.title3,
    color: c.text,
    marginBottom: spacing.sm,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  topicChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: c.surfaceTint,
  },
  topicChipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: c.text,
  },
});

export default ContentScreen;
