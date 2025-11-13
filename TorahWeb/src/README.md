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
│   └── ContentScreen.tsx     # Display individual content items
│
├── services/         # API and external service integrations
│   └── api.ts               # API service for fetching data from TorahWeb.org
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

## Services

### api.ts
Service layer for communicating with TorahWeb.org API.

**Current Status**: Using mock data
**TODO**: Replace mock data with actual API endpoints from TorahWeb.org

Available methods:
- `getAuthors()` - Fetch all authors
- `getTopics()` - Fetch all topics
- `searchContent(params)` - Search content with filters
- `getArticles()` - Fetch all articles
- `getVideos()` - Fetch all videos
- `getAudio()` - Fetch all audio

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

