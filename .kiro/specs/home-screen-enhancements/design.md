# Design Document

## Overview

This design document outlines the architecture and implementation strategy for enhancing the StreamScribe home screen with improved empty states, loading indicators, error handling, personalized content discovery, and quick actions. New sections will be added at the top of the homepage, while keeping the existing "Your Watchlist" section and "StartWatchingWidget" unchanged.

The home screen serves as the primary entry point for users and must balance multiple concerns:
- Fast initial load times with progressive content loading
- Clear feedback about system state (loading, errors, empty states)
- Personalized content discovery based on user preferences and watch history
- Quick access to common actions without navigation overhead
- Graceful degradation when services are unavailable
- **Preserve existing watchlist and recommendation widget functionality**

## Architecture

### Component Structure

The enhanced home screen will add new sections at the top while preserving existing sections:

```
HomeScreen (app/(tabs)/index.tsx)
├── Header (existing - sticky with blur)
├── ConnectionBanner (existing)
├── WelcomeModal (new - overlay for first-time users)
├── ScrollView
│   ├── ImpactHeader (existing - enhanced with loading/error states)
│   ├── QuickFilters (new - All/Movies/TV chips)
│   ├── SurpriseButton (new - random recommendation)
│   ├── ContinueWatchingSection (new - in-progress content)
│   ├── WatchlistSection (existing - UNCHANGED, add empty/loading/error states)
│   ├── StartWatchingWidget (existing - UNCHANGED, keep as-is)
│   ├── BecauseYouWatchedSection (new - personalized recommendations)
│   ├── GenreSection (new - genre-based content)
│   ├── NewThisWeekSection (new - recent releases)
│   ├── LeavingSoonSection (new - expiring content)
│   └── MediaSection (existing - enhanced with loading/error states)
```

**Key Principle:** The "Your Watchlist" section and "StartWatchingWidget" remain in their current positions and functionality. New sections are inserted around them.

### State Management

The home screen will manage the following state:

```typescript
interface HomeScreenState {
  // Existing state (UNCHANGED - keep all existing functionality)
  sections: Section[];
  watchlist: WatchlistItem[];
  nextEpisodes: Record<number, { season: number; episode: number }>;
  stats: { savings: number; efficiency: number; streak: number };
  loading: boolean;
  refreshing: boolean;
  
  // New state for enhancements
  continueWatching: ContinueWatchingItem[];
  becauseYouWatched: BecauseYouWatchedSection[];
  genreSections: GenreSection[];
  newThisWeek: (Movie | TVShow)[];
  leavingSoon: LeavingSoonItem[];
  activeFilter: 'all' | 'movie' | 'tv';
  sectionLoadingStates: Record<string, boolean>;
  sectionErrors: Record<string, string | null>;
  showWelcome: boolean;
}
```

### Service Layer

New services will be created to support the enhanced functionality:

1. **ContinueWatchingService** - Manages in-progress content
2. **PersonalizationService** - Generates "Because You Watched" recommendations
3. **ContentDiscoveryService** - Handles "New This Week" and "Leaving Soon"
4. **OnboardingService** - Manages first-time user experience

Existing services will be extended:
- **TasteProfileService** - Add genre-based section generation
- **StorageService** - Add onboarding state persistence

## Components and Interfaces

### New Components

#### 1. EmptyState Component

```typescript
interface EmptyStateProps {
  type: 'watchlist' | 'continue-watching' | 'section' | 'generic';
  title: string;
  message: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

Displays when no content is available for a section. Includes illustration, message, and optional call-to-action button.

#### 2. SkeletonLoader Component

```typescript
interface SkeletonLoaderProps {
  type: 'card' | 'header' | 'section';
  count?: number;
  animated?: boolean;
}
```

Displays animated placeholder UI while content loads. Matches the layout of actual content.

#### 3. ErrorState Component

```typescript
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}
```

Displays when content fails to load. Includes error message and retry button.

#### 4. QuickFilters Component

```typescript
interface QuickFiltersProps {
  activeFilter: 'all' | 'movie' | 'tv';
  onFilterChange: (filter: 'all' | 'movie' | 'tv') => void;
}
```

Horizontal chip buttons for filtering content by type.

#### 5. SurpriseButton Component

```typescript
interface SurpriseButtonProps {
  onPress: () => void;
  loading?: boolean;
}
```

Prominent button that navigates to a random recommendation.

#### 6. ContinueWatchingSection Component

```typescript
interface ContinueWatchingSectionProps {
  items: ContinueWatchingItem[];
  onItemPress: (item: ContinueWatchingItem) => void;
  onRemove: (id: number, type: 'movie' | 'tv') => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

Displays in-progress content with progress indicators.

#### 7. BecauseYouWatchedSection Component

```typescript
interface BecauseYouWatchedSectionProps {
  sourceTitle: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

Displays personalized recommendations based on a specific watched item.

#### 8. GenreSection Component

```typescript
interface GenreSectionProps {
  genreName: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

Displays content filtered by genre.

#### 9. NewThisWeekSection Component

```typescript
interface NewThisWeekSectionProps {
  items: (Movie | TVShow)[];
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

Displays recently released content.

#### 10. LeavingSoonSection Component

```typescript
interface LeavingSoonSectionProps {
  items: LeavingSoonItem[];
  onItemPress: (item: LeavingSoonItem) => void;
  onWatchlistPress: (item: LeavingSoonItem) => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

Displays content leaving streaming services soon with departure dates.

#### 11. WelcomeModal Component

```typescript
interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
  onGetStarted: () => void;
}
```

First-time user onboarding modal with feature highlights.

### Enhanced Existing Components

#### MediaSection Component

Will be enhanced to support:
- Loading states with skeleton screens
- Error states with retry functionality
- Empty states when no data available
- Filter support (show/hide based on active filter)

```typescript
interface EnhancedMediaSectionProps extends MediaSectionProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  filterType?: 'all' | 'movie' | 'tv';
  activeFilter?: 'all' | 'movie' | 'tv';
}
```

## Data Models

### ContinueWatchingItem

```typescript
interface ContinueWatchingItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  
  // Progress information
  progress: number; // 0-100 percentage
  lastWatchedAt: string; // ISO date
  
  // TV-specific
  nextEpisode?: {
    season: number;
    episode: number;
    name: string;
  };
  
  // Movie-specific
  runtime?: number; // minutes
  watchedMinutes?: number;
}
```

### BecauseYouWatchedSection

```typescript
interface BecauseYouWatchedSection {
  sourceId: number;
  sourceTitle: string;
  sourceType: 'movie' | 'tv';
  items: (Movie | TVShow)[];
}
```

### GenreSection

```typescript
interface GenreSection {
  genreId: number;
  genreName: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
}
```

### LeavingSoonItem

```typescript
interface LeavingSoonItem extends Movie | TVShow {
  departureDate: string; // ISO date
  providerName: string;
  providerLogoUrl?: string;
  daysRemaining: number;
}
```

### OnboardingState

```typescript
interface OnboardingState {
  hasSeenWelcome: boolean;
  welcomeDismissedAt?: string;
  onboardingVersion: number; // For future updates
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

Before defining the correctness properties, let's identify and eliminate redundancy:

**Redundancies Identified:**
1. Properties 4.2, 4.3, 4.4 can be combined into a single comprehensive property about continue watching item structure and ordering
2. Properties 5.1, 5.2, 5.3, 5.4 can be consolidated into one property about recommendation generation
3. Properties 6.1, 6.2, 6.3, 6.5 can be combined into one property about genre section generation
4. Properties 9.2, 9.3, 9.4 can be combined into one property about new content filtering and ordering
5. Properties 10.2, 10.3, 10.4 can be combined into one property about leaving soon item structure and ordering

**Consolidated Properties:**
- Continue Watching: Single property covering ordering, episode info, and progress
- Because You Watched: Single property covering generation logic, similarity, and limits
- Genre Sections: Single property covering analysis, generation, and labeling
- New This Week: Single property covering date filtering, content types, and ordering
- Leaving Soon: Single property covering dates, ordering, and badges

### Correctness Properties

Property 1: Continue watching items are properly structured and ordered
*For any* list of in-progress content, continue watching items should be ordered by most recently watched, TV shows should include next episode information, and movies should include progress percentages
**Validates: Requirements 4.2, 4.3, 4.4**

Property 2: Recommendation sections are generated with proper limits and similarity
*For any* user with watch history, "Because You Watched" sections should use genre/rating similarity, be limited to a maximum of three sections, and prioritize recently watched and highly rated source items
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

Property 3: Genre sections are generated from watch history analysis
*For any* user with genre preferences, genre sections should be generated for the top three preferred genres with clear genre name labels
**Validates: Requirements 6.1, 6.2, 6.3, 6.5**

Property 4: Content filtering applies consistently across all sections
*For any* active filter (all/movie/tv), all content sections should display only items matching that filter type
**Validates: Requirements 7.2**

Property 5: Filter selection persists during session
*For any* filter selection, the active filter should remain unchanged until explicitly changed or the session ends
**Validates: Requirements 7.5**

Property 6: Surprise Me selects from available recommendations
*For any* "Surprise Me" action, the system should select a random item from taste profile recommendations, or from trending content if recommendations are unavailable
**Validates: Requirements 8.2, 8.4**

Property 7: New This Week content is properly filtered and ordered
*For any* "New This Week" section, all items should have release dates within the last seven days, include both movies and TV shows, and be ordered by release date descending
**Validates: Requirements 9.2, 9.3, 9.4**

Property 8: Leaving Soon items are properly structured and ordered
*For any* "Leaving Soon" section, all items should display departure dates, be ordered by earliest departure date first, and show warning badges for watchlist items
**Validates: Requirements 10.2, 10.3, 10.4**

Property 9: Welcome modal dismissal persists
*For any* user who dismisses the welcome modal, the dismissal state should be stored persistently and the modal should not appear again
**Validates: Requirements 11.4**

## Error Handling

### Error Categories

1. **Network Errors**
   - No internet connection
   - Timeout errors
   - DNS resolution failures
   
   **Handling:** Display network-specific error message with retry option. Cache last successful data when possible.

2. **API Errors**
   - TMDB API failures (4xx, 5xx responses)
   - Rate limiting
   - Invalid responses
   
   **Handling:** Display user-friendly error message. Fall back to cached data or mock data. Provide retry option.

3. **Data Errors**
   - Missing required fields
   - Invalid data formats
   - Parsing failures
   
   **Handling:** Log error details. Skip invalid items. Display partial results with warning if applicable.

4. **Storage Errors**
   - AsyncStorage failures
   - Supabase connection issues
   - Data corruption
   
   **Handling:** Fall back to in-memory state. Display warning to user. Retry on next app launch.

### Error Recovery Strategies

1. **Graceful Degradation**
   - Show cached content when fresh data unavailable
   - Display partial results when some sections fail
   - Hide failed sections rather than showing error for entire screen

2. **Retry Logic**
   - Exponential backoff for automatic retries
   - Manual retry buttons for user-initiated retries
   - Section-specific retry (don't reload entire screen)

3. **User Communication**
   - Clear, non-technical error messages
   - Specific guidance on how to resolve issues
   - Visual distinction between loading, error, and empty states

### Error State UI Patterns

```typescript
// Section-level error handling
<MediaSection
  title="Trending Movies"
  data={trendingMovies}
  loading={loadingStates.trending}
  error={errors.trending}
  onRetry={() => retrySection('trending')}
  emptyMessage="No trending movies available"
/>

// Global error handling
if (criticalError) {
  return <ErrorScreen message={criticalError} onRetry={loadAllData} />;
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases:

1. **Component Rendering**
   - Empty state displays when data is empty
   - Skeleton screens display during loading
   - Error states display with retry buttons
   - Filter chips render correctly
   - Welcome modal appears for first-time users

2. **User Interactions**
   - Filter selection updates active filter
   - Retry button triggers reload function
   - Surprise Me button navigates to random item
   - Welcome modal dismissal updates storage

3. **Edge Cases**
   - Empty watchlist shows empty state
   - No recommendations shows fallback content
   - No new content hides section
   - No leaving soon content hides section

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** (JavaScript/TypeScript property testing library):

1. **Property 1: Continue watching ordering and structure**
   - Generate random lists of in-progress items with timestamps
   - Verify items are sorted by most recent
   - Verify TV shows include episode info
   - Verify movies include progress percentages

2. **Property 2: Recommendation generation limits**
   - Generate random watch histories
   - Verify no more than 3 "Because You Watched" sections
   - Verify recommendations use similarity scoring
   - Verify source items are prioritized correctly

3. **Property 3: Genre section generation**
   - Generate random watch histories with genres
   - Verify top 3 genres are selected
   - Verify sections have correct genre labels

4. **Property 4: Content filtering consistency**
   - Generate random content sections with mixed types
   - Apply each filter (all/movie/tv)
   - Verify all sections show only matching content

5. **Property 5: Filter persistence**
   - Generate random filter selections
   - Verify filter remains active until changed

6. **Property 6: Surprise Me selection**
   - Generate random recommendation lists
   - Verify selection is from available items
   - Verify fallback to trending when empty

7. **Property 7: New This Week filtering**
   - Generate random content with various release dates
   - Verify only items within 7 days are included
   - Verify both movies and TV shows present
   - Verify ordering by release date descending

8. **Property 8: Leaving Soon ordering**
   - Generate random leaving soon items with dates
   - Verify ordering by earliest departure date
   - Verify watchlist items have badges

9. **Property 9: Welcome modal persistence**
   - Simulate dismissal actions
   - Verify storage is updated
   - Verify modal doesn't reappear

### Testing Requirements

- Each property-based test MUST run a minimum of 100 iterations
- Each property-based test MUST be tagged with: `**Feature: home-screen-enhancements, Property {number}: {property_text}**`
- Each correctness property MUST be implemented by a SINGLE property-based test
- Unit tests and property tests are complementary and both MUST be included

## Performance Considerations

### Loading Strategy

1. **Progressive Loading**
   - Load user data first (watchlist, stats) - fastest, from local storage
   - Load personalized sections second (continue watching, recommendations)
   - Load TMDB content last (trending, new releases)

2. **Parallel Requests**
   - Batch TMDB API calls using Promise.all
   - Load independent sections simultaneously
   - Don't block UI on slow sections

3. **Caching**
   - Cache TMDB responses for 24 hours
   - Cache taste profile for 5 minutes
   - Cache genre analysis for 1 hour

### Rendering Optimization

1. **Virtualization**
   - Use FlatList for horizontal scrolling sections
   - Implement windowSize optimization
   - Remove items from memory when off-screen

2. **Memoization**
   - Memoize expensive calculations (taste scores, genre analysis)
   - Use React.memo for section components
   - Avoid unnecessary re-renders with useCallback

3. **Lazy Loading**
   - Load sections as user scrolls
   - Defer non-critical sections (leaving soon, new this week)
   - Prioritize above-the-fold content

## Accessibility

1. **Screen Reader Support**
   - Proper labels for all interactive elements
   - Announce loading states
   - Announce errors with severity

2. **Keyboard Navigation**
   - Tab order follows visual hierarchy
   - Filter chips keyboard accessible
   - Retry buttons keyboard accessible

3. **Visual Accessibility**
   - Sufficient color contrast for text
   - Error states use color + icon
   - Loading states use animation + text

## Migration Strategy

### Phase 1: Foundation (Week 1)
- Create new component library (EmptyState, SkeletonLoader, ErrorState)
- Add loading and error state management to home screen
- Implement section-level error handling

### Phase 2: Empty States (Week 1)
- Add empty state to watchlist section
- Add empty states to all media sections
- Implement welcome modal for first-time users

### Phase 3: Personalization (Week 2)
- Create ContinueWatchingService
- Implement Continue Watching section
- Create PersonalizationService
- Implement "Because You Watched" sections

### Phase 4: Discovery (Week 2)
- Implement genre-based sections
- Create ContentDiscoveryService
- Implement "New This Week" section
- Implement "Leaving Soon" section

### Phase 5: Quick Actions (Week 3)
- Implement filter chips
- Implement "Surprise Me" button
- Add filter persistence

### Phase 6: Polish (Week 3)
- Add skeleton screens to all sections
- Implement smooth transitions
- Performance optimization
- Accessibility improvements

## Dependencies

### External Libraries
- `react-native-reanimated` - Already in use for animations
- `expo-blur` - Already in use for header blur
- `@react-native-async-storage/async-storage` - Already in use for storage
- `fast-check` - NEW - For property-based testing

### Internal Services
- `tmdbService` - Existing, will be extended
- `storageService` - Existing, will be extended
- `tasteProfileService` - Existing, will be extended
- `progressService` - Existing, will be used
- `continueWatchingService` - NEW
- `personalizationService` - NEW
- `contentDiscoveryService` - NEW
- `onboardingService` - NEW

### Database Schema
No new tables required. Will use existing:
- `watchlists` - For watchlist data
- `episode_progress` - For continue watching
- `user_preferences` - For onboarding state and filter preferences
- `media_cache` - For TMDB response caching
