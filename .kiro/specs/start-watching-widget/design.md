# Design Document

## Overview

The Start Watching Widget is a swipe-based discovery interface that displays 3 recommendation cards horizontally. Users can swipe right to mark as watched, left to dismiss, or up to remove from watchlist. The widget intelligently transitions from watchlist-based recommendations to taste-based recommendations when the watchlist is exhausted.

## Architecture

### Component Structure

```
StartWatchingWidget/
├── StartWatchingWidget.tsx          # Main container component
├── SwipeableCard.tsx                # Individual swipeable card with gesture handling
├── SwipeOverlay.tsx                 # Visual feedback overlay during swipe
├── TransitionMessage.tsx            # Message shown when switching recommendation modes
└── EmptyState.tsx                   # Empty state when no recommendations available
```

### Services

```
services/
├── tasteProfileService.ts           # Analyzes user taste and generates recommendations
├── recommendationQueueService.ts    # Manages the 3-card queue and fetching logic
└── swipeActionService.ts            # Handles swipe actions (watch, dismiss, remove)
```

### Data Flow

```
1. Widget Mount
   ↓
2. Load User Preferences & Subscriptions
   ↓
3. Fetch Watchlist Recommendations (Phase 1)
   ↓
4. Display 3 Cards Horizontally
   ↓
5. User Swipes Card
   ↓
6. Process Action (watch/dismiss/remove)
   ↓
7. Fetch Replacement Card
   ↓
8. If Watchlist Exhausted → Show Transition Message
   ↓
9. Switch to Taste-Based Recommendations (Phase 2)
   ↓
10. Continue Queue Management
```

## Components

### StartWatchingWidget

**Purpose:** Main container that manages state, queue, and recommendation phases

**Props:**
```typescript
interface StartWatchingWidgetProps {
  onItemPress?: (item: RecommendationItem, type: 'movie' | 'tv') => void;
  refreshTrigger?: number;
}
```

**State:**
```typescript
interface WidgetState {
  cards: RecommendationItem[];           // Current 3 cards
  phase: 'watchlist' | 'taste' | 'transition';
  dismissedIds: Set<string>;             // Dismissed item IDs
  isLoading: boolean;
  error: string | null;
  lastUpdate: string;
}
```

**Key Methods:**
- `loadInitialRecommendations()` - Loads first 3 watchlist items
- `fetchNextRecommendation()` - Gets next item based on current phase
- `handleSwipeAction(cardId, action)` - Processes swipe actions
- `switchToTastePhase()` - Transitions to taste-based recommendations
- `replaceCard(index, newCard)` - Replaces card at specific position

### SwipeableCard

**Purpose:** Individual card with gesture handling and animations

**Props:**
```typescript
interface SwipeableCardProps {
  item: RecommendationItem;
  index: number;                         // Position in row (0, 1, or 2)
  onSwipeRight: () => void;              // Mark as watched
  onSwipeLeft: () => void;               // Dismiss
  onSwipeUp: () => void;                 // Remove from watchlist
  onPress: () => void;                   // Navigate to details
  disabled: boolean;                     // Disable during animations
}
```

**Gesture Thresholds:**
```typescript
const SWIPE_THRESHOLD = {
  horizontal: 120,    // pixels
  vertical: 100,      // pixels
  velocity: 0.3       // pixels per ms
};
```

**Animation States:**
- `idle` - Card at rest
- `dragging` - User is swiping
- `returning` - Animating back to center
- `exiting` - Animating off-screen

### SwipeOverlay

**Purpose:** Visual feedback showing which action will be triggered

**Props:**
```typescript
interface SwipeOverlayProps {
  direction: 'left' | 'right' | 'up' | null;
  opacity: number;                       // 0 to 1 based on swipe distance
}
```

**Overlay Styles:**
```typescript
const OVERLAY_CONFIG = {
  right: {
    color: '#4CAF50',                    // Green
    icon: 'checkmark-circle',
    text: 'WATCHED',
    gradient: ['rgba(76, 175, 80, 0)', 'rgba(76, 175, 80, 0.9)']
  },
  left: {
    color: '#FF6B35',                    // Orange
    icon: 'time-outline',
    text: 'LATER',
    gradient: ['rgba(255, 107, 53, 0)', 'rgba(255, 107, 53, 0.9)']
  },
  up: {
    color: '#F44336',                    // Red
    icon: 'trash-outline',
    text: 'REMOVE',
    gradient: ['rgba(244, 67, 54, 0)', 'rgba(244, 67, 54, 0.9)']
  }
};
```

## Data Models

### RecommendationItem

```typescript
interface RecommendationItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  providerName: string;
  providerLogoUrl?: string;
  source: 'watchlist' | 'taste';         // Which phase it came from
  tasteScore?: number;                   // Relevance score for taste recommendations
  genres?: number[];                     // Genre IDs
}
```

### TasteProfile

```typescript
interface TasteProfile {
  userId: string;
  favoriteGenres: GenreScore[];         // Sorted by frequency
  averageRating: number;                 // User's average rating
  contentTypePreference: {               // Movie vs TV preference
    movie: number;                       // 0-1
    tv: number;                          // 0-1
  };
  watchFrequency: {                      // Viewing patterns
    moviesPerWeek: number;
    episodesPerWeek: number;
  };
  recentlyWatched: number[];             // Last 20 watched item IDs
  preferredProviders: string[];          // Most used streaming services
}

interface GenreScore {
  genreId: number;
  genreName: string;
  count: number;                         // How many watched
  avgRating: number;                     // Average rating for this genre
}
```

## Services

### TasteProfileService

**Purpose:** Analyzes user data to build taste profile and generate recommendations

**Key Methods:**

```typescript
class TasteProfileService {
  // Build taste profile from user's watch history
  async buildTasteProfile(userId: string): Promise<TasteProfile> {
    // 1. Query user_activity table for watched content
    // 2. Query watchlist for added items and ratings
    // 3. Query user_progress for TV show viewing patterns
    // 4. Analyze genres, ratings, content types
    // 5. Calculate preferences and patterns
    // 6. Return comprehensive taste profile
  }

  // Generate recommendations based on taste profile
  async generateTasteRecommendations(
    profile: TasteProfile,
    subscribedServices: string[],
    excludeIds: Set<string>,
    limit: number = 10
  ): Promise<RecommendationItem[]> {
    // 1. Query TMDB for content matching top genres
    // 2. Filter by subscribed streaming services
    // 3. Exclude already dismissed/watched items
    // 4. Score each recommendation based on profile match
    // 5. Sort by score and return top results
  }

  // Calculate how well a piece of content matches user's taste
  calculateTasteScore(
    content: TMDBContent,
    profile: TasteProfile
  ): number {
    // Genre match (40%)
    // Rating similarity (30%)
    // Content type preference (20%)
    // Recency (10%)
    // Return 0-100 score
  }
}
```

**Database Queries:**

```sql
-- Get user's watched content with genres
SELECT 
  wa.content_id,
  wa.content_type,
  wa.watched_at,
  w.vote_average,
  w.genre_ids
FROM user_activity wa
LEFT JOIN watchlist w ON wa.content_id = w.id AND wa.content_type = w.type
WHERE wa.user_id = $1 AND wa.activity_type = 'watched'
ORDER BY wa.watched_at DESC
LIMIT 50;

-- Get user's viewing frequency
SELECT 
  content_type,
  COUNT(*) as count,
  AVG(vote_average) as avg_rating
FROM user_activity
WHERE user_id = $1 AND activity_type = 'watched'
  AND watched_at > NOW() - INTERVAL '30 days'
GROUP BY content_type;

-- Get user's genre preferences
SELECT 
  genre_id,
  COUNT(*) as watch_count,
  AVG(vote_average) as avg_rating
FROM (
  SELECT 
    unnest(w.genre_ids) as genre_id,
    w.vote_average
  FROM user_activity ua
  JOIN watchlist w ON ua.content_id = w.id
  WHERE ua.user_id = $1 AND ua.activity_type = 'watched'
) genre_data
GROUP BY genre_id
ORDER BY watch_count DESC, avg_rating DESC
LIMIT 10;
```

### RecommendationQueueService

**Purpose:** Manages the 3-card queue and fetching logic

**Key Methods:**

```typescript
class RecommendationQueueService {
  private watchlistQueue: RecommendationItem[] = [];
  private tasteQueue: RecommendationItem[] = [];
  private currentPhase: 'watchlist' | 'taste' = 'watchlist';

  // Initialize with watchlist recommendations
  async initializeQueue(
    userId: string,
    subscribedServices: string[]
  ): Promise<RecommendationItem[]> {
    // 1. Fetch unwatched watchlist items
    // 2. Filter by subscribed services
    // 3. Shuffle for variety
    // 4. Return first 3 items
  }

  // Get next recommendation based on current phase
  async getNextRecommendation(
    userId: string,
    subscribedServices: string[],
    dismissedIds: Set<string>
  ): Promise<RecommendationItem | null> {
    if (this.currentPhase === 'watchlist') {
      // Try to get from watchlist queue
      const next = this.watchlistQueue.shift();
      if (next) return next;
      
      // Watchlist exhausted, switch to taste
      this.currentPhase = 'taste';
      return this.getNextRecommendation(userId, subscribedServices, dismissedIds);
    } else {
      // Get from taste queue or generate new
      if (this.tasteQueue.length === 0) {
        await this.refillTasteQueue(userId, subscribedServices, dismissedIds);
      }
      return this.tasteQueue.shift() || null;
    }
  }

  // Refill taste queue with new recommendations
  private async refillTasteQueue(
    userId: string,
    subscribedServices: string[],
    dismissedIds: Set<string>
  ): Promise<void> {
    const profile = await tasteProfileService.buildTasteProfile(userId);
    const recommendations = await tasteProfileService.generateTasteRecommendations(
      profile,
      subscribedServices,
      dismissedIds,
      10
    );
    this.tasteQueue = recommendations;
  }

  // Check if should transition to taste phase
  shouldTransitionToTaste(): boolean {
    return this.currentPhase === 'watchlist' && this.watchlistQueue.length === 0;
  }
}
```

### SwipeActionService

**Purpose:** Handles swipe actions and updates backend

**Key Methods:**

```typescript
class SwipeActionService {
  // Handle swipe right (mark as watched)
  async markAsWatched(
    item: RecommendationItem,
    userId: string
  ): Promise<void> {
    if (item.type === 'tv') {
      // Mark episode 1 season 1 as watched
      await progressService.markEpisodeWatched(item.id, 1, 1);
    } else {
      // Mark movie as watched
      await storageService.markAsWatched(item);
    }
    
    // Log action for analytics
    await this.logAction(userId, item.id, 'watched');
  }

  // Handle swipe left (dismiss)
  async dismissRecommendation(
    item: RecommendationItem,
    userId: string
  ): Promise<void> {
    // Just track locally - no backend change needed
    // Item stays in watchlist but won't show in widget
    await this.logAction(userId, item.id, 'dismissed');
  }

  // Handle swipe up (remove from watchlist)
  async removeFromWatchlist(
    item: RecommendationItem,
    userId: string
  ): Promise<void> {
    await storageService.removeFromWatchlist(item.id, item.type);
    await this.logAction(userId, item.id, 'removed');
  }

  // Log action for analytics
  private async logAction(
    userId: string,
    contentId: number,
    action: 'watched' | 'dismissed' | 'removed'
  ): Promise<void> {
    // Insert into user_activity or analytics table
  }
}
```

## Animations

### Card Swipe Animation

```typescript
// Using react-native-reanimated
const SwipeAnimation = {
  // Drag animation
  onDrag: (translationX, translationY) => {
    'worklet';
    return {
      translateX: translationX,
      translateY: translationY,
      rotate: `${translationX / 10}deg`,  // Subtle rotation
      scale: 1 - Math.abs(translationX) / 1000  // Slight scale down
    };
  },

  // Return to center animation
  returnToCenter: {
    translateX: withSpring(0, { damping: 15, stiffness: 150 }),
    translateY: withSpring(0, { damping: 15, stiffness: 150 }),
    rotate: withSpring('0deg'),
    scale: withSpring(1)
  },

  // Exit animation
  exitAnimation: (direction: 'left' | 'right' | 'up') => {
    const exitX = direction === 'left' ? -400 : direction === 'right' ? 400 : 0;
    const exitY = direction === 'up' ? -400 : 0;
    
    return {
      translateX: withTiming(exitX, { duration: 300, easing: Easing.out(Easing.cubic) }),
      translateY: withTiming(exitY, { duration: 300, easing: Easing.out(Easing.cubic) }),
      opacity: withTiming(0, { duration: 300 }),
      scale: withTiming(0.8, { duration: 300 })
    };
  },

  // New card entrance animation
  entranceAnimation: {
    opacity: withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(100, withTiming(1, { duration: 400 }))
    ),
    scale: withSequence(
      withTiming(0.8, { duration: 0 }),
      withDelay(100, withSpring(1, { damping: 12, stiffness: 100 }))
    )
  }
};
```

### Overlay Opacity Animation

```typescript
// Calculate overlay opacity based on swipe distance
const calculateOverlayOpacity = (
  translation: number,
  threshold: number
): number => {
  'worklet';
  const progress = Math.abs(translation) / threshold;
  return Math.min(progress, 1);  // Cap at 1
};
```

## Error Handling

### Network Errors

```typescript
// Retry logic with exponential backoff
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(Math.pow(2, i) * 1000);  // 1s, 2s, 4s
      }
    }
  }
  
  throw lastError!;
}
```

### Action Failures

```typescript
// Revert card on action failure
async function handleSwipeWithRollback(
  card: RecommendationItem,
  action: SwipeAction,
  onRevert: () => void
): Promise<void> {
  try {
    await swipeActionService[action](card);
  } catch (error) {
    console.error(`Failed to ${action}:`, error);
    onRevert();  // Put card back in queue
    showErrorToast(`Failed to ${action}. Please try again.`);
  }
}
```

## Testing Strategy

### Unit Tests

- TasteProfileService.buildTasteProfile()
- TasteProfileService.calculateTasteScore()
- RecommendationQueueService.getNextRecommendation()
- SwipeActionService action methods
- Animation calculations

### Integration Tests

- Full swipe flow (swipe → action → fetch → replace)
- Phase transition (watchlist → taste)
- Queue management with multiple swipes
- Error recovery scenarios

### E2E Tests

- User swipes through all watchlist items
- User dismisses and removes items
- Widget transitions to taste recommendations
- Widget handles empty states correctly

## Performance Considerations

### Optimization Strategies

1. **Prefetch Next Card** - Load next recommendation in background while user views current cards
2. **Image Caching** - Cache poster images aggressively
3. **Debounce Swipes** - Prevent multiple rapid swipes from causing race conditions
4. **Memoization** - Memoize taste profile calculation (cache for 5 minutes)
5. **Lazy Loading** - Only load taste recommendations when needed
6. **Animation Performance** - Use `useNativeDriver: true` for all animations

### Memory Management

```typescript
// Cleanup on unmount
useEffect(() => {
  return () => {
    // Cancel pending requests
    abortController.abort();
    // Clear queues
    recommendationQueueService.clear();
    // Remove event listeners
    gestureHandler.removeAllListeners();
  };
}, []);
```

## Accessibility

### Alternative Interaction Methods

```typescript
// Button alternatives for swipe gestures
<View style={styles.actionButtons}>
  <TouchableOpacity onPress={() => handleSwipeUp(card)}>
    <Ionicons name="trash-outline" size={24} />
    <Text>Remove</Text>
  </TouchableOpacity>
  
  <TouchableOpacity onPress={() => handleSwipeLeft(card)}>
    <Ionicons name="time-outline" size={24} />
    <Text>Later</Text>
  </TouchableOpacity>
  
  <TouchableOpacity onPress={() => handleSwipeRight(card)}>
    <Ionicons name="checkmark-circle" size={24} />
    <Text>Watched</Text>
  </TouchableOpacity>
</View>
```

### Screen Reader Support

```typescript
<View accessible={true} accessibilityLabel={`${item.title}, ${item.type}, available on ${item.providerName}. Swipe right to mark as watched, left to dismiss, or up to remove from watchlist.`}>
  {/* Card content */}
</View>
```
