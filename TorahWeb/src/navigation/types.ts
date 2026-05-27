import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Content, ContentType } from '../types';

// Content can be addressed two ways:
// - in-app pushes pass the fully hydrated Content object (already loaded by
//   the previous screen, so we avoid a redundant fetch).
// - deep links arrive with only an id + kind in the URL; ContentScreen
//   resolves these via api.getArticle / getVideo / getAudio.
export type ContentRouteParams =
  | { content: Content }
  | { contentId: string; contentKind: ContentType };

export type SearchRouteParams = {
  authorId?: string;
  topicSlug?: string;
  // Browse a single parsha or yom tov by its content `parshaLabel`. Drives
  // the leaf list of the Parsha / Yom Tov drill-down menus.
  parshaLabel?: string;
  contentType?: ContentType;
  showAll?: boolean;
  title?: string;
};

// Drill-down menus that mirror torahweb.org: the Parsha button opens the list
// of chumashim ('parshaBooks'), each chumash opens its parshiyos
// ('parshaBook'), and the Yom Tov button opens the list of yomim tovim
// ('yomtov'). Leaf taps navigate to Search with a `parshaLabel`.
export type MenuRouteParams =
  | { menu: 'parshaBooks'; title?: string }
  | { menu: 'parshaBook'; bookId: string; title?: string }
  | { menu: 'yomtov'; title?: string };

export type HomeStackParamList = {
  Home: undefined;
  Menu: MenuRouteParams;
  Search: SearchRouteParams;
  Content: ContentRouteParams;
};

export type SearchStackParamList = {
  SearchRoot: SearchRouteParams | undefined;
  Content: ContentRouteParams;
};

// The "New" tab is a dedicated Recently Added feed. It reuses SearchScreen
// (seeded with showAll) so it shares the same list/sort/filter behavior as
// Home's "See All → Newest".
export type NewStackParamList = {
  NewRoot: SearchRouteParams | undefined;
  Content: ContentRouteParams;
};

export type LibraryStackParamList = {
  Library: undefined;
  Content: ContentRouteParams;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  NewTab: NavigatorScreenParams<NewStackParamList>;
  LibraryTab: NavigatorScreenParams<LibraryStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
