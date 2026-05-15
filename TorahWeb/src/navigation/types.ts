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
  contentType?: ContentType;
  showAll?: boolean;
  title?: string;
};

export type HomeStackParamList = {
  Home: undefined;
  Search: SearchRouteParams;
  Content: ContentRouteParams;
};

export type SearchStackParamList = {
  SearchRoot: SearchRouteParams | undefined;
  Content: ContentRouteParams;
};

export type LibraryStackParamList = {
  Library: undefined;
  Content: ContentRouteParams;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  LibraryTab: NavigatorScreenParams<LibraryStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
