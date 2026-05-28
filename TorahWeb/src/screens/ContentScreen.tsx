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
import { colors, radii, shadows, spacing, typography } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import { api } from '../services/api';
import { canDownloadContent, downloadContent } from '../services/download';
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
  const params = route.params;
  const [content, setContent] = useState<Content | null>(
    'content' in params ? params.content : null,
  );
  const [downloading, setDownloading] = useState(false);

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
    (async () => {
      const { contentId, contentKind } = params;
      const fetched =
        contentKind === 'article'
          ? await api.getArticle(contentId)
          : contentKind === 'video'
            ? await api.getVideo(contentId)
            : await api.getAudio(contentId);
      if (!cancelled && fetched) setContent(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [content, params]);

  if (!content) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  const showDownload = canDownloadContent(content);
  const artwork = content.author.portraitUrl;

  const onDownload = async () => {
    if (downloading || !showDownload) return;
    setDownloading(true);
    try {
      await downloadContent(content);
    } finally {
      setDownloading(false);
    }
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
            />
          ) : null}
          {showDownload ? (
            <GlassButton
              style={styles.downloadButton}
              contentStyle={styles.downloadButtonInner}
              cornerRadius={radii.pill}
              tint="rgba(26, 58, 92, 0.92)"
              disabled={downloading}
              accessibilityRole="button"
              accessibilityLabel={downloading ? 'Downloading' : `Download ${content.title}`}
              accessibilityState={{ disabled: downloading, busy: downloading }}
              onPress={onDownload}>
              <Icon
                name="arrow.down.circle.fill"
                size={18}
                color={colors.textInverse}
              />
              <Text style={styles.downloadText}>
                {downloading ? 'Downloading…' : 'Download'}
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
            <Icon name="square.and.arrow.up" size={18} color={colors.text} />
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
const HTML_TAGS_STYLES: MixedStyleRecord = {
  body: {
    color: colors.text,
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
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h2: {
    ...(typography.title2 as MixedStyleDeclaration),
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h3: {
    ...(typography.title3 as MixedStyleDeclaration),
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.navy,
    paddingLeft: spacing.md,
    marginVertical: spacing.md,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  ul: { marginTop: 0, marginBottom: spacing.md, paddingLeft: spacing.lg },
  ol: { marginTop: 0, marginBottom: spacing.md, paddingLeft: spacing.lg },
  li: { marginBottom: spacing.xs },
  a: { color: colors.navy, textDecorationLine: 'underline' },
};

const ARTICLE_BODY_HPADDING = spacing.lg;

type RenderHTMLRenderersProps = React.ComponentProps<typeof RenderHTML>['renderersProps'];

const ArticleHtml: React.FC<{
  html: string;
  // `<a>` tap routing is owned by ContentScreen (it has the navigation ref);
  // ArticleHtml just forwards it to RenderHTML.
  renderersProps: RenderHTMLRenderersProps;
}> = ({ html, renderersProps }) => {
  const { width } = useWindowDimensions();
  // articleBody sits inside the screen's horizontal padding (spacing.lg
  // on each side). RenderHTML needs the *interior* width to size images
  // and inline content correctly.
  const contentWidth = useMemo(
    () => Math.max(0, width - ARTICLE_BODY_HPADDING * 2),
    [width],
  );
  const source = useMemo(() => ({ html }), [html]);
  return (
    <RenderHTML
      contentWidth={contentWidth}
      source={source}
      tagsStyles={HTML_TAGS_STYLES}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
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
    backgroundColor: colors.navyDark,
    marginBottom: spacing.xl,
    ...shadows.elevated,
  },
  artworkPlaceholder: {
    backgroundColor: colors.navy,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  author: {
    ...typography.headline,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    ...typography.subheadline,
    color: colors.textTertiary,
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
    color: colors.textInverse,
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
    color: colors.text,
    marginTop: spacing.md,
  },
  topicsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  topicsHeading: {
    ...typography.title3,
    color: colors.text,
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
    backgroundColor: colors.surfaceTint,
  },
  topicChipText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
  },
});

export default ContentScreen;
