# Profile Redesign - Design Document

## Overview

This design document outlines the technical approach for redesigning the profile screen with a bold, modern aesthetic using a black and orange color scheme. The redesign transforms the profile into a premium, engaging experience that showcases user stats, achievements, and viewing activity while maintaining excellent usability.

## Design Principles

1. **Bold Visual Hierarchy** - Large typography, prominent stats, clear sections
2. **Orange Accent Strategy** - Strategic use of #FF6600 for emphasis and engagement
3. **Premium Feel** - Polished animations, smooth interactions, attention to detail
4. **Data-Driven** - Showcase meaningful metrics that motivate continued engagement
5. **Modular Architecture** - Reusable components that can be enhanced over time

---

## Architecture

### Component Structure

```
ProfileScreen (app/(tabs)/profile.tsx)
├── AnimatedScrollView (with parallax header)
├── StickyHeader (with blur effect)
│   ├── Logo
│   └── SettingsButton
├── ProfileHeader (enhanced)
│   ├── AvatarWithGlow
│   ├── UserName
│   ├── UserEmail
│   └── EditProfileButton
├── StatsGrid (new)
│   ├── StreakCard
│   ├── EpisodesCard
│   ├── ShowsCard
│   └── PointsCard
├── AchievementShowcase (enhanced)
│   ├── AchievementStatsCard (existing)
│   └── FeaturedAchievements
├── QuickActionsGrid (enhanced)
│   ├── NotificationSettings
│   ├── AchievementSettings
│   ├── ConnectionTest
│   └── ViewingHistory
└── PersonalInformation (existing)
```

### Data Flow

```
ProfileScreen
    ↓
[Load User Data] → AuthContext
    ↓
[Load Activity Stats] → userActivityService (new)
    ↓
[Load Achievement Stats] → achievementsService (existing)
    ↓
[Render Components] → Display with animations
```

---

## Components and Interfaces

### 1. Enhanced ProfileHeader

**Purpose:** Display user identity with premium visual treatment

**Visual Design:**
- Large circular avatar (120x120) with user initial
- Orange glow effect (shadowColor: #FF6600, shadowRadius: 20, shadowOpacity: 0.6)
- Bold white name (32px, weight: 700)
- Muted email (16px, color: #888888)
- Edit button with orange border on press

**Props:**
```typescript
interface ProfileHeaderProps {
  user: User;
  onEditPress: () => void;
}
```

**Animations:**
- Parallax effect on scroll (avatar scales down 0.8x)
- Glow pulse animation on mount (subtle)

---

### 2. StatsGrid (New Component)

**Purpose:** Display key metrics in an engaging grid layout

**Layout:** 2x2 grid with equal-sized cards

**Cards:**

#### StreakCard
- **Icon:** Flame (Ionicons: flame)
- **Primary Value:** Current streak (e.g., "7 days")
- **Secondary Value:** Longest streak (e.g., "Best: 30")
- **Color:** Orange gradient background (#FF6600 → #FF8833)
- **Animation:** Flame flicker effect

#### EpisodesCard
- **Icon:** Play circle (Ionicons: play-circle)
- **Primary Value:** Total episodes watched
- **Secondary Value:** "Episodes watched"
- **Color:** Dark surface with orange accent
- **Animation:** Counter animation on load

#### ShowsCard
- **Icon:** TV (Ionicons: tv)
- **Primary Value:** Shows completed
- **Secondary Value:** "Shows finished"
- **Color:** Dark surface with orange accent
- **Animation:** Counter animation on load

#### PointsCard
- **Icon:** Star (Ionicons: star)
- **Primary Value:** Achievement points
- **Secondary Value:** "Achievement points"
- **Color:** Dark surface with orange accent
- **Animation:** Counter animation on load

**Component Interface:**
```typescript
interface StatsGridProps {
  stats: UserStats;
  loading?: boolean;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalEpisodes: number;
  showsCompleted: number;
  achievementPoints: number;
}
```

**Styling:**
```typescript
{
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  card: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakCard: {
    background: 'linear-gradient(135deg, #FF6600 0%, #FF8833 100%)',
  }
}
```

---

### 3. AchievementShowcase (Enhanced)

**Purpose:** Highlight achievement progress and featured achievements

**Components:**
- **AchievementStatsCard** (existing) - Circular progress, tier breakdown
- **FeaturedAchievements** (new) - Horizontal scrollable list of recent/close achievements

**FeaturedAchievements:**
- Shows 3-5 achievements
- Recent unlocks (last 3)
- Close to unlock (>75% progress)
- Horizontal scroll with snap
- Each card shows: icon, name, progress bar, points

**Component Interface:**
```typescript
interface FeaturedAchievementsProps {
  achievements: Achievement[];
  onAchievementPress: (achievement: Achievement) => void;
}
```

---

### 4. QuickActionsGrid (Enhanced)

**Purpose:** Provide quick access to key features

**Layout:** 2x2 grid with icon-based cards

**Actions:**
1. **Notification Settings**
   - Icon: bell (Ionicons)
   - Label: "Notifications"
   - Route: /notification-settings

2. **Achievement Settings**
   - Icon: trophy (Ionicons)
   - Label: "Achievements"
   - Route: /achievement-settings

3. **Connection Test**
   - Icon: wifi (Ionicons)
   - Label: "Connection"
   - Route: /connection-test

4. **Viewing History**
   - Icon: time (Ionicons)
   - Label: "History"
   - Route: /viewing-history (future)

**Visual Design:**
- Large icon (32px) in orange
- Label below (14px, white)
- Card background: Colors.surface
- Orange border on press
- Haptic feedback on tap

**Component Interface:**
```typescript
interface QuickAction {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge?: number; // Optional notification badge
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}
```

---

## Data Models

### UserStats Interface

```typescript
interface UserStats {
  // Streak data
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  
  // Viewing data
  totalEpisodes: number;
  totalHoursWatched: number;
  showsCompleted: number;
  
  // Achievement data
  achievementPoints: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  
  // Impact data (future)
  totalSavings: number;
  optimizedHours: number;
  monthlyEfficiency: number;
}
```

### UserActivityTracking (Database)

```typescript
interface UserActivityTracking {
  user_id: string;
  last_app_open: string;
  last_episode_watched: string;
  last_watchlist_update: string;
  total_app_opens: number;
  total_episodes_watched: number;
  total_watchlist_updates: number;
  total_hours_watched: number;
  average_session_length: number;
  preferred_watch_time: string;
  weekly_watch_pattern: number[];
  engagement_score: number;
  current_streak: number;
  longest_streak: number;
  last_streak_date: string;
  total_savings: number;
  monthly_efficiency: number;
  optimized_hours: number;
  created_at: string;
  updated_at: string;
}
```

---

## Services

### UserActivityService (New)

**Purpose:** Manage user activity stats and streak tracking

**Location:** `services/userActivity.ts`

**Methods:**

```typescript
class UserActivityService {
  /**
   * Get user activity stats
   */
  async getUserStats(userId: string): Promise<UserStats>;
  
  /**
   * Update streak when episode is watched
   */
  async updateStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }>;
  
  /**
   * Get shows completed count
   */
  async getShowsCompleted(userId: string): Promise<number>;
  
  /**
   * Get total episodes watched
   */
  async getTotalEpisodes(userId: string): Promise<number>;
  
  /**
   * Initialize activity tracking for new user
   */
  async initializeUserActivity(userId: string): Promise<void>;
  
  /**
   * Cache user stats locally
   */
  private async cacheUserStats(userId: string, stats: UserStats): Promise<void>;
  
  /**
   * Get cached user stats
   */
  private async getCachedUserStats(userId: string): Promise<UserStats | null>;
}

export const userActivityService = new UserActivityService();
```

**Implementation Notes:**
- Use Supabase to query `user_activity_tracking` table
- Cache stats in AsyncStorage for offline access
- Integrate with existing `progressService` for episode counts
- Integrate with existing `achievementsService` for points

---

## Animation Strategy

### 1. Scroll Animations

**Parallax Header:**
```typescript
const scrollY = useSharedValue(0);

const headerStyle = useAnimatedStyle(() => ({
  transform: [
    { scale: interpolate(scrollY.value, [0, 200], [1, 0.8], Extrapolation.CLAMP) },
    { translateY: interpolate(scrollY.value, [0, 200], [0, -50], Extrapolation.CLAMP) }
  ],
  opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolation.CLAMP)
}));
```

**Sticky Header Blur:**
```typescript
const blurStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP)
}));
```

### 2. Card Animations

**Staggered Fade-In:**
```typescript
const fadeAnim = useSharedValue(0);

useEffect(() => {
  fadeAnim.value = withDelay(
    index * 100,
    withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
  );
}, []);
```

**Counter Animation:**
```typescript
const animatedValue = useSharedValue(0);

useEffect(() => {
  animatedValue.value = withTiming(targetValue, {
    duration: 1000,
    easing: Easing.out(Easing.cubic)
  });
}, [targetValue]);
```

### 3. Streak Flame Animation

**Flicker Effect:**
```typescript
const flameScale = useSharedValue(1);

useEffect(() => {
  flameScale.value = withRepeat(
    withSequence(
      withTiming(1.1, { duration: 300 }),
      withTiming(0.95, { duration: 300 }),
      withTiming(1, { duration: 300 })
    ),
    -1, // Infinite
    false
  );
}, []);
```

### 4. Haptic Feedback

**On Card Press:**
```typescript
import * as Haptics from 'expo-haptics';

const handleCardPress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  // Navigate or perform action
};
```

---

## Color Scheme

### Primary Colors
```typescript
{
  primary: '#FF6600',      // Orange accent
  secondary: '#C4460C',    // Darker orange
  accent: '#990000',       // Deep red
}
```

### Background Colors
```typescript
{
  background: '#000000',   // Pure black
  surface: '#1A1A1A',      // Dark gray cards
  card: '#2A2A2A',         // Lighter gray
}
```

### Text Colors
```typescript
{
  text: '#FFFFFF',         // Primary text
  textSecondary: '#CCCCCC', // Secondary text
  textMuted: '#888888',    // Muted text
}
```

### Semantic Colors
```typescript
{
  border: '#333333',       // Card borders
  success: '#4CAF50',      // Success states
  warning: '#FFC107',      // Warning states
  error: '#F44336',        // Error states
}
```

### Gradient (Streak Card)
```typescript
{
  streakGradient: ['#FF6600', '#FF8833'],
}
```

---

## Integration Points

### 1. Existing Components

**Leverage:**
- `AchievementStatsCard` - Already styled with orange accents
- `AchievementBadge` - Display user's current badge
- `ProgressStats` - Show currently watching shows
- `Logo` - Use in sticky header

**Enhance:**
- Add animations to `AchievementStatsCard`
- Improve `ProgressStats` layout for profile context

### 2. Existing Services

**Use:**
- `achievementsService` - Get achievement stats and points
- `progressService` - Get episode progress and show completions
- `authService` - Get user data

**Create:**
- `userActivityService` - New service for activity stats

### 3. Database Integration

**Tables:**
- `user_activity_tracking` - Streak, episodes, hours
- `achievements` - Achievement definitions
- `user_achievements` - Unlocked achievements
- `show_progress` - Show completion status
- `episode_progress` - Episode watch history

**Queries:**
```sql
-- Get user stats
SELECT 
  current_streak,
  longest_streak,
  total_episodes_watched,
  total_hours_watched,
  total_savings,
  optimized_hours
FROM user_activity_tracking
WHERE user_id = $1;

-- Get shows completed
SELECT COUNT(*) 
FROM show_progress 
WHERE user_id = $1 AND status = 'completed';

-- Get achievement points
SELECT SUM(a.points) as total_points
FROM user_achievements ua
JOIN achievements a ON ua.achievement_id = a.id
WHERE ua.user_id = $1;
```

---

## Error Handling

### Loading States

**Skeleton Screens:**
```typescript
{
  showSkeleton && (
    <View style={styles.skeletonCard}>
      <SkeletonPlaceholder>
        <View style={styles.skeletonContent} />
      </SkeletonPlaceholder>
    </View>
  )
}
```

### Empty States

**New User (No Data):**
```typescript
{
  stats.totalEpisodes === 0 && (
    <View style={styles.emptyState}>
      <Ionicons name="tv-outline" size={48} color={Colors.textMuted} />
      <Text style={styles.emptyText}>Start watching to see your stats!</Text>
    </View>
  )
}
```

### Error States

**Failed to Load:**
```typescript
{
  error && (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle" size={48} color={Colors.error} />
      <Text style={styles.errorText}>Failed to load stats</Text>
      <TouchableOpacity onPress={retry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  )
}
```

---

## Testing Strategy

### Unit Tests

**Test Coverage:**
- `userActivityService` methods
- Stats calculation logic
- Streak update logic
- Cache management

**Example:**
```typescript
describe('UserActivityService', () => {
  it('should calculate current streak correctly', async () => {
    const stats = await userActivityService.getUserStats(userId);
    expect(stats.currentStreak).toBe(7);
  });
  
  it('should update streak when episode watched', async () => {
    const result = await userActivityService.updateStreak(userId);
    expect(result.currentStreak).toBeGreaterThan(0);
  });
});
```

### Component Tests

**Test Coverage:**
- StatsGrid renders correctly
- QuickActionsGrid navigation works
- Animations trigger properly
- Loading states display

**Example:**
```typescript
describe('StatsGrid', () => {
  it('should render all stat cards', () => {
    const { getByText } = render(<StatsGrid stats={mockStats} />);
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('Episodes watched')).toBeTruthy();
  });
});
```

### Integration Tests

**Test Coverage:**
- Profile loads user data
- Stats update after watching episode
- Navigation to settings works
- Pull-to-refresh updates data

---

## Performance Considerations

### 1. Data Caching

**Strategy:**
- Cache user stats in AsyncStorage
- TTL: 5 minutes
- Background refresh on focus
- Optimistic updates for streak

### 2. Image Optimization

**Strategy:**
- Use expo-image for avatar
- Lazy load achievement icons
- Cache images locally

### 3. Animation Performance

**Strategy:**
- Use `useNativeDriver: true` where possible
- Limit concurrent animations
- Debounce scroll events
- Use `InteractionManager` for heavy operations

### 4. Query Optimization

**Strategy:**
- Batch database queries
- Use indexes on frequently queried columns
- Implement pagination for achievement lists
- Cache achievement definitions

---

## Accessibility

### Screen Reader Support

```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Current streak: 7 days"
  accessibilityHint="View your viewing streak details"
  accessibilityRole="button"
>
  <StreakCard />
</TouchableOpacity>
```

### Color Contrast

- Ensure 4.5:1 contrast ratio for text
- Orange (#FF6600) on black (#000000) = 5.8:1 ✓
- White (#FFFFFF) on surface (#1A1A1A) = 15.2:1 ✓

### Touch Targets

- Minimum 44x44 points for all interactive elements
- Adequate spacing between cards (12px minimum)

---

## Future Enhancements

### Phase 2 Features

1. **Viewing History Timeline**
   - Chronological list of watched episodes
   - Filter by date range
   - Search functionality

2. **Social Features**
   - Share profile
   - Compare stats with friends
   - Leaderboards

3. **Insights & Analytics**
   - Viewing patterns graph
   - Genre preferences
   - Watch time trends

4. **Customization**
   - Profile themes
   - Custom avatar upload
   - Badge display preferences

5. **Gamification**
   - Daily challenges
   - Bonus streak multipliers
   - Seasonal events

---

## Migration Strategy

### Backward Compatibility

- Keep existing profile functional during development
- Feature flag for new design
- Gradual rollout to users

### Data Migration

- Run `add_streak_and_impact_stats.sql` migration
- Backfill streak data from episode history
- Initialize activity tracking for existing users

### Rollback Plan

- Keep old profile component as fallback
- Feature flag to toggle between old/new
- Monitor error rates and user feedback

---

## Success Metrics

### Key Performance Indicators

1. **User Engagement**
   - Profile view duration (target: +50%)
   - Return visits to profile (target: +30%)
   - Achievement settings access (target: +40%)

2. **Technical Performance**
   - Profile load time (target: <2 seconds)
   - Animation frame rate (target: 60fps)
   - Cache hit rate (target: >80%)

3. **User Satisfaction**
   - User feedback rating (target: 4.5+/5)
   - Feature usage rate (target: >60%)
   - Streak engagement (target: >40% daily active)

---

## Implementation Notes

### Development Phases

**Phase 1: Core Components (Week 1)**
- Create StatsGrid component
- Create userActivityService
- Implement basic animations

**Phase 2: Enhanced Features (Week 2)**
- Add FeaturedAchievements
- Enhance QuickActionsGrid
- Implement streak tracking

**Phase 3: Polish & Testing (Week 3)**
- Add loading/error states
- Implement animations
- Write tests
- Performance optimization

### Dependencies

**New:**
- None (use existing expo packages)

**Existing:**
- expo-blur
- expo-haptics
- react-native-reanimated
- expo-symbols

---

## Conclusion

This design creates a bold, premium profile experience that:
- Showcases user achievements and progress
- Motivates continued engagement through streaks
- Provides quick access to key features
- Maintains excellent performance
- Follows iOS design principles
- Leverages existing components and services

The modular architecture allows for future enhancements while maintaining a solid foundation for the current implementation.
