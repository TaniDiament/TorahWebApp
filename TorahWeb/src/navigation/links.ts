import type { Content, ContentType } from '../types';

// The canonical, shareable URL for a content item. It must agree with three
// other places or shared links break:
//   1. the `linking` config in AppNavigator (content/:contentKind/:contentId),
//   2. the Universal Link / App Link path scope (/content/*) declared in the
//      iOS entitlement + AndroidManifest and the hosted
//      apple-app-site-association / assetlinks.json,
//   3. the static page the build emits at dist/content/<kind>/<id>/ (see
//      Jsongenerators/_common.py).
// Because the same build pipeline mints both the content id and that page,
// the link the app shares is always one the website can serve.
export const SITE_ORIGIN = 'https://www.torahweb.org';

export const canonicalContentUrl = (kind: ContentType, id: string): string =>
  `${SITE_ORIGIN}/content/${kind}/${id}`;

export const contentShareUrl = (content: Content): string =>
  canonicalContentUrl(content.kind, content.id);

// Imported article bodies keep the legacy site's trailing "More divrei Torah
// on …" links, e.g. <a href="../../../special.html">. Left alone they open the
// website in a browser; resolveInternalLink classifies the ones that have an
// in-app equivalent so ContentScreen can navigate there instead. Anything it
// doesn't recognise (external sites, mailto:, a specific dvar Torah we can't
// map client-side) returns null and falls back to the browser.
export type InternalLink =
  | { kind: 'topic'; slug: string; title: string }
  | { kind: 'author'; authorId: string }
  | { kind: 'yomtov' }
  | { kind: 'parsha' };

// Reduce an href to a site-root-relative path, or null if it isn't a
// torahweb.org page. Handles both the relative form stored in article bodies
// (`../../../special.html`) and an absolute torahweb.org URL.
const toSitePath = (href: string): string | null => {
  let p = href.trim();
  const abs = p.match(/^https?:\/\/(?:www\.)?torahweb\.org\/(.*)$/i);
  if (abs) {
    p = abs[1];
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//')) {
    return null; // some other scheme/host — not internal
  } else {
    p = p.replace(/^(?:\.\.?\/)+/, ''); // drop the leading ../ climb to root
  }
  return p.replace(/^\//, '').replace(/[?#].*$/, '');
};

export const resolveInternalLink = (href: string): InternalLink | null => {
  const path = toSitePath(href);
  if (!path) return null;
  if (path === 'special.html') {
    return { kind: 'topic', slug: 'special', title: 'Special Topics' };
  }
  const author = path.match(/^author\/([a-z0-9]+)\.html$/i);
  if (author) return { kind: 'author', authorId: author[1].toLowerCase() };
  // Specific chag / parsha leaves can't be mapped to a label client-side
  // (that lives in the build's taxonomy), so route to the section instead.
  if (/^yomtov\//i.test(path)) return { kind: 'yomtov' };
  if (/^parsha\//i.test(path)) return { kind: 'parsha' };
  return null;
};
