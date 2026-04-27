# TorahWeb App Structure

This directory contains all the source code for the TorahWeb React Native application.

## Directory Structure

```
src/
├── components/        # Reusable UI components
│   ├── ArticleCard.tsx       # Card component for displaying content items
│   ├── AudioPlayer.tsx       # Audio playback component
│   ├── AuthorButton.tsx      # Button component for author selection
│   ├── TopicButton.tsx       # Button component for topic selection
│   └── VideoPlayer.tsx       # Video playback component
│
├── screens/          # Main application screens
│   ├── HomeScreen.tsx        # Home page with authors and topics
│   ├── SearchScreen.tsx      # Search interface with filtering
│   ├── ContentScreen.tsx     # Display individual content items
│   └── DownloadsScreen.tsx   # Offline downloads / library
│
├── services/         # API and external service integrations
│   ├── api.ts               # Provider switch (mock ↔ real backend)
│   ├── provider.ts          # ContentProvider interface
│   ├── mockProvider.ts      # Mock data for offline development
│   ├── realProvider.ts      # Real provider — fetches static JSON backend
│   ├── searchIndexCache.ts  # On-device delta-synced search index cache
│   ├── luceneSearch.ts      # Client-side Lucene inverted-index search
│   └── download.ts          # Offline download manager
│
├── audio/            # Audio playback provider and hooks
│
└── types/            # TypeScript type definitions
    └── index.ts             # Shared interfaces and types
```

## Components

### AuthorButton & TopicButton
Reusable button components for the home screen that display authors and topics.

### ArticleCard
Displays a preview of content (article, video, or audio) in a list view.

### VideoPlayer & AudioPlayer
Components for playing media content. Currently use Linking to open in external players.
- **TODO**: Install `react-native-video` for embedded video playback
- **TODO**: Install `react-native-sound` or `react-native-track-player` for embedded audio playback

## Screens

### HomeScreen
- Displays buttons for all authors and topics
- Fetches data on mount using the API service
- Shows loading state while data is being fetched

### SearchScreen
- Text input for searching content
- Filter buttons for content type (All, Articles, Videos, Audio)
- Displays search results in a list
- Minimum 3 characters required for search

### ContentScreen
- Displays full content based on type
- Shows article text, or video/audio players
- Displays author information and topics

### DownloadsScreen
- Offline library for downloaded articles and audio

## Services

### api.ts
Provider switch: flip `USE_REAL_BACKEND` to toggle between mock data
and the live static-JSON backend on torahweb.org.

### realProvider.ts
Fetches static JSON files published by `build_all.py` / `add_content.py`
(see `Jsongenerators/README.md`). All endpoints are plain files — no
query strings — so every request is cacheable by any CDN.

### searchIndexCache.ts
On-device cache for the full-text search index. Implements the delta
protocol documented in `/BACKEND_SCHEMA.md`:
- Syncs `search/full-v{N}.json` (entries) and `search/lucene-v{N}.json`
  (pre-computed inverted index) to the device's document directory.
- Applies delta updates when available to avoid re-downloading the full
  index on every content publish.

### luceneSearch.ts
**Client-side search over a Lucene-produced inverted index.**

At build time, Apache Lucene (Java) tokenizes each document with
`EnglishAnalyzer` (lowercase → stop-word removal → Porter stemming),
scores every term per document using BM25, and exports the results as
JSON: `{ terms: { "<stem>": [{ id, s: score }, …] }, … }`.

At query time, this module:
1. Applies the same pipeline to the query (lowercase → stop words →
   Porter stemmer).
2. Looks up each stemmed term in the pre-computed `Map`.
3. Intersects posting lists (AND semantics) and sums BM25 scores.
4. Returns ranked results.

No native Lucene dependency — pure TypeScript with a built-in Porter
stemmer.

## Types

All TypeScript interfaces are defined in `types/index.ts`:
- `Author` - Author information
- `Topic` - Topic information
- `Article` - Article content with text
- `Video` - Video content with URL
- `Audio` - Audio content with URL
- `Content` - Union type of Article | Video | Audio
- `ContentType` - Literal type for filtering
- `SearchParams` - Search query parameters
- `DownloadItem` - Offline download metadata

## Next Steps

1. **Implement Real API Integration**
   - Replace mock data in `api.ts` with actual API calls to TorahWeb.org
   - Add error handling and loading states
   - Implement pagination if needed

2. **Add Media Player Libraries**
   ```bash
   npm install react-native-video
   npm install react-native-sound
   # or
   npm install react-native-track-player
   ```

3. **Add Navigation**
   ```bash
   npm install @react-navigation/native @react-navigation/stack
   npm install react-native-screens react-native-safe-area-context
   ```

4. **Add State Management** (if needed)
   - Consider Redux, MobX, or React Context for global state
   - Store favorites, search history, etc.

5. **Enhance UI**
   - Add images for authors
   - Improve styling and theming
   - Add dark mode support
   - Add pull-to-refresh

6. **Add Features**
   - Favorites/bookmarks
   - Share content
   - Download for offline viewing
   - Push notifications
   - User accounts
