# Design Document

## Overview

The achievements system will gamify the StreamScribe experience by tracking and rewarding user milestones across viewing habits, consistency, and economic optimization. The system integrates with existing database tables (episode_progress, user_impact_stats, user_activity_tracking) and introduces new tables for achievement definitions and user achievement progress. The UI will feature beautiful trophy visuals using React Native icon libraries, with tier-based color schemes and celebratory animations.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ AchievementsScreen│  │ Achievement      │                │
│  │                   │  │ Notification     │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ achievements.ts  │  │ achievementCheck │                │
│  │                  │  │ .ts              │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Supabase         │  │ AsyncStorage     │                │
│  │ (achievements,   │  │ (local cache)    │                │
│  │  user_achievements)│                   │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Existing Data Sources                      │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ episode_progress │  │ user_impact_stats│                │
│  │ user_activity_   │  │                  │                │
│  │ tracking         │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Achievement Trigger**: User action (episode watched, streak maintained, savings milestone)
2. **Progress Check**: Achievement service queries relevant data sources
3. **Unlock Detection**: Service compares progress against achievement criteria
4. **Persistence**: New achievement unlock saved to database
5. **Notification**: In-app and/or push notification displayed
6. **UI Update**: Achievements screen reflects new unlock

## Components and Interfaces

### Database Schema

#### achievements Table
Stores the definition of all available achievements.

```sql
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key TEXT UNIQUE NOT NULL, -- e.g., 'first_steps', 'binge_watcher'
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('viewing', 'streaks', 'completions', 'savings', 'efficiency')),
    tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    icon_name TEXT NOT NULL, -- e.g., 'trophy', 'medal', 'star'
    icon_library TEXT NOT NULL DEFAULT 'Ionicons', -- 'Ionicons', 'MaterialCommunityIcons', 'FontAwesome'
    unlock_criteria JSONB NOT NULL, -- { "type": "episode_count", "value": 10 }
    points INTEGER NOT NULL DEFAULT 10,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### user_achievements Table
Tracks which achievements each user has unlocked.

```sql
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_value DECIMAL(10,2), -- Current progress toward achievement (for display)
    notified BOOLEAN DEFAULT FALSE,
    notification_shown BOOLEAN DEFAULT FALSE, -- In-app notification displayed
    push_sent BOOLEAN DEFAULT FALSE, -- Push notification sent
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);
CREATE INDEX idx_user_achievements_notification_shown ON user_achievements(notification_shown) WHERE notification_shown = FALSE;
```

#### achievement_notification_preferences Table
Stores user preferences for achievement notifications.

```sql
CREATE TABLE achievement_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    in_app_full_screen BOOLEAN DEFAULT TRUE,
    in_app_banner BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    haptic_enabled BOOLEAN DEFAULT TRUE,
    progress_reminders BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE achievement_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification preferences" 
    ON achievement_notification_preferences FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" 
    ON achievement_notification_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" 
    ON achievement_notification_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
```

#### achievement_progress Table
Tracks real-time progress toward locked achievements.

```sql
CREATE TABLE achievement_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    target_value DECIMAL(10,2) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_achievement_progress_user_id ON achievement_progress(user_id);
```

### TypeScript Interfaces

```typescript
// types/index.ts additions

export interface Achievement {
    id: string;
    achievement_key: string;
    name: string;
    description: string;
    category: 'viewing' | 'streaks' | 'completions' | 'savings' | 'efficiency';
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    icon_name: string;
    icon_library: 'Ionicons' | 'MaterialCommunityIcons' | 'FontAwesome';
    unlock_criteria: UnlockCriteria;
    points: number;
    sort_order: number;
}

export interface UnlockCriteria {
    type: 'episode_count' | 'streak_days' | 'show_completions' | 'total_savings' | 'monthly_efficiency';
    value: number;
    comparison?: 'gte' | 'lte' | 'eq'; // greater than or equal, less than or equal, equal
}

export interface UserAchievement {
    id: string;
    user_id: string;
    achievement_id: string;
    achievement?: Achievement; // Joined data
    unlocked_at: string;
    progress_value?: number;
    notified: boolean;
}

export interface AchievementProgress {
    id: string;
    user_id: string;
    achievement_id: string;
    achievement?: Achievement;
    current_value: number;
    target_value: number;
    last_updated: string;
    progress_percentage: number; // Calculated: (current_value / target_value) * 100
}

export interface AchievementStats {
    total_unlocked: number;
    total_available: number;
    completion_percentage: number;
    total_points: number;
    by_tier: {
        bronze: { unlocked: number; total: number };
        silver: { unlocked: number; total: number };
        gold: { unlocked: number; total: number };
        platinum: { unlocked: number; total: number };
    };
    recent_achievements: UserAchievement[];
    close_to_unlock: AchievementProgress[]; // >75% progress
}

export interface AchievementNotificationPreferences {
    user_id: string;
    in_app_full_screen: boolean; // Show full unlock screen
    in_app_banner: boolean; // Show compact banner
    push_notifications: boolean; // Send push notifications
    sound_enabled: boolean; // Play sound on unlock
    haptic_enabled: boolean; // Vibrate on unlock
    progress_reminders: boolean; // Notify when close to unlock (>90%)
    updated_at: string;
}

export interface AchievementNotificationQueue {
    id: string;
    achievement: Achievement;
    timestamp: string;
    displayed: boolean;
}
```

### Service Layer

#### achievements.ts
Main service for achievement operations.

```typescript
class AchievementsService {
    // Core Methods
    async getAllAchievements(): Promise<Achievement[]>
    async getUserAchievements(userId: string): Promise<UserAchievement[]>
    async getAchievementProgress(userId: string): Promise<AchievementProgress[]>
    async getAchievementStats(userId: string): Promise<AchievementStats>
    
    // Achievement checking
    async checkAndUnlockAchievements(userId: string, triggerType: string): Promise<UserAchievement[]>
    
    // Progress tracking
    async updateAchievementProgress(userId: string, achievementId: string, currentValue: number): Promise<void>
    
    // Notification handling
    async showAchievementUnlock(achievement: Achievement, displayMode: 'full' | 'banner'): Promise<void>
    async sendPushNotification(userId: string, achievement: Achievement): Promise<void>
    async queueAchievementNotification(achievement: Achievement): Promise<void>
    
    // Caching
    private async cacheAchievements(): Promise<void>
    private async getCachedAchievements(): Promise<Achievement[]>
}
```

#### achievementNotifications.ts
Handles achievement notification delivery and display.

```typescript
class AchievementNotificationsService {
    // In-app notifications
    async showUnlockScreen(achievement: Achievement): Promise<void>
    async showUnlockBanner(achievement: Achievement): Promise<void>
    async queueNotification(achievement: Achievement): Promise<void>
    async processNotificationQueue(): Promise<void>
    
    // Push notifications
    async sendAchievementPushNotification(userId: string, achievement: Achievement): Promise<void>
    async scheduleAchievementReminder(userId: string, achievement: Achievement, progress: number): Promise<void>
    
    // Preferences
    async getNotificationPreferences(userId: string): Promise<AchievementNotificationPreferences>
    async updateNotificationPreferences(userId: string, prefs: Partial<AchievementNotificationPreferences>): Promise<void>
}
```

#### achievementChecker.ts
Handles the logic for checking achievement unlock conditions.

```typescript
class AchievementChecker {
    // Check specific achievement types
    async checkEpisodeAchievements(userId: string): Promise<string[]> // Returns unlocked achievement IDs
    async checkStreakAchievements(userId: string): Promise<string[]>
    async checkCompletionAchievements(userId: string): Promise<string[]>
    async checkSavingsAchievements(userId: string): Promise<string[]>
    async checkEfficiencyAchievements(userId: string): Promise<string[]>
    
    // Helper methods
    private async getTotalEpisodesWatched(userId: string): Promise<number>
    private async getCurrentStreak(userId: string): Promise<number>
    private async getTotalCompletedShows(userId: string): Promise<number>
    private async getTotalSavings(userId: string): Promise<number>
    private async getMonthlyEfficiency(userId: string): Promise<number>
}
```

### UI Components

#### AchievementsScreen
Main screen displaying all achievements.

**Props**: None (uses auth context for user)

**Features**:
- Category tabs (All, Viewing, Streaks, Completions, Savings, Efficiency)
- Achievement grid with trophy icons
- Progress bars for locked achievements
- Stats summary at top
- Pull-to-refresh

#### AchievementCard
Individual achievement display component.

**Props**:
```typescript
interface AchievementCardProps {
    achievement: Achievement;
    userAchievement?: UserAchievement;
    progress?: AchievementProgress;
    onPress: () => void;
}
```

**Features**:
- Trophy icon with tier-based coloring
- Locked/unlocked state styling
- Progress bar (if locked)
- Unlock date (if unlocked)

#### AchievementDetailModal
Modal showing detailed achievement information.

**Props**:
```typescript
interface AchievementDetailModalProps {
    achievement: Achievement;
    userAchievement?: UserAchievement;
    progress?: AchievementProgress;
    visible: boolean;
    onClose: () => void;
}
```

**Features**:
- Large trophy icon
- Full description
- Unlock criteria
- Rarity percentage
- Unlock date or progress

#### AchievementUnlockScreen
Full-screen modal celebrating achievement unlocks in real-time.

**Props**:
```typescript
interface AchievementUnlockScreenProps {
    achievement: Achievement;
    visible: boolean;
    onClose: () => void;
}
```

**Features**:
- Full-screen overlay with semi-transparent background
- Large animated trophy icon (scales in with bounce effect)
- Tier-specific background gradient
- Particle/confetti animation system
- Achievement name with typewriter effect
- Achievement description fade-in
- Points earned display with counter animation
- Glow/shine effects around trophy
- Sound effect on unlock (optional)
- "Tap to continue" prompt
- Share button to share achievement

**Animation Sequence**:
1. Background fades in (0-200ms)
2. Trophy scales in with bounce (200-800ms)
3. Confetti bursts from trophy (500ms)
4. Achievement name types in (800-1200ms)
5. Description fades in (1200-1500ms)
6. Points counter animates (1500-2000ms)
7. Continue prompt pulses (2000ms+)

#### AchievementNotificationBanner
Compact in-app banner for achievement unlocks (alternative to full screen).

**Props**:
```typescript
interface AchievementNotificationBannerProps {
    achievement: Achievement;
    visible: boolean;
    onDismiss: () => void;
    onPress: () => void; // Opens full unlock screen
}
```

**Features**:
- Slides down from top of screen
- Compact trophy icon with tier color
- Achievement name and tier badge
- Auto-dismiss after 5 seconds
- Tap to expand to full unlock screen
- Swipe up to dismiss
- Queue multiple notifications

#### AchievementStatsCard
Summary statistics component.

**Props**:
```typescript
interface AchievementStatsCardProps {
    stats: AchievementStats;
}
```

**Features**:
- Total unlocked / total available
- Completion percentage with circular progress
- Points earned
- Tier breakdown

## Data Models

### Achievement Categories and Definitions

#### Viewing Milestones
- **First Steps** (Bronze, 10 pts): Watch 1 episode
- **Getting Started** (Bronze, 20 pts): Watch 10 episodes
- **Binge Watcher** (Silver, 50 pts): Watch 50 episodes
- **Series Enthusiast** (Silver, 100 pts): Watch 100 episodes
- **TV Connoisseur** (Gold, 200 pts): Watch 250 episodes
- **Marathon Master** (Gold, 300 pts): Watch 500 episodes
- **Legendary Viewer** (Platinum, 500 pts): Watch 1000 episodes

#### Streak Achievements
- **Weekend Warrior** (Bronze, 15 pts): 3-day streak
- **Week Streak** (Silver, 50 pts): 7-day streak
- **Monthly Marathon** (Gold, 150 pts): 30-day streak
- **Century Streak** (Gold, 300 pts): 100-day streak
- **Year-Round Viewer** (Platinum, 1000 pts): 365-day streak

#### Show Completions
- **Series Finisher** (Bronze, 25 pts): Complete 1 show
- **Completionist** (Silver, 75 pts): Complete 5 shows
- **Series Collector** (Silver, 150 pts): Complete 10 shows
- **Finale Expert** (Gold, 300 pts): Complete 25 shows
- **Ultimate Completionist** (Platinum, 750 pts): Complete 50 shows

#### Economic Savings
- **Smart Saver** (Bronze, 20 pts): Save $10
- **Budget Master** (Silver, 75 pts): Save $50
- **Thrifty Viewer** (Silver, 150 pts): Save $100
- **Savings Expert** (Gold, 300 pts): Save $250
- **Financial Guru** (Gold, 500 pts): Save $500
- **Ultimate Optimizer** (Platinum, 1000 pts): Save $1000

#### Efficiency Achievements
- **Efficient Streamer** (Silver, 50 pts): ≤$2/hour for 1 month
- **Value Champion** (Gold, 150 pts): ≤$1/hour for 1 month
- **Optimization Master** (Gold, 300 pts): ≤$0.50/hour for 1 month
- **Consistent Optimizer** (Platinum, 500 pts): Maintain optimal efficiency for 3 months

### Trophy Icon Mapping

```typescript
const ACHIEVEMENT_ICONS = {
    viewing: {
        bronze: { name: 'trophy-outline', library: 'Ionicons' },
        silver: { name: 'trophy', library: 'Ionicons' },
        gold: { name: 'trophy', library: 'Ionicons' },
        platinum: { name: 'trophy', library: 'Ionicons' }
    },
    streaks: {
        bronze: { name: 'flame-outline', library: 'Ionicons' },
        silver: { name: 'flame', library: 'Ionicons' },
        gold: { name: 'flame', library: 'Ionicons' },
        platinum: { name: 'flame', library: 'Ionicons' }
    },
    completions: {
        bronze: { name: 'star-outline', library: 'Ionicons' },
        silver: { name: 'star', library: 'Ionicons' },
        gold: { name: 'star', library: 'Ionicons' },
        platinum: { name: 'star', library: 'Ionicons' }
    },
    savings: {
        bronze: { name: 'cash-outline', library: 'Ionicons' },
        silver: { name: 'cash', library: 'Ionicons' },
        gold: { name: 'cash', library: 'Ionicons' },
        platinum: { name: 'cash', library: 'Ionicons' }
    },
    efficiency: {
        bronze: { name: 'speedometer-outline', library: 'Ionicons' },
        silver: { name: 'speedometer', library: 'Ionicons' },
        gold: { name: 'speedometer', library: 'Ionicons' },
        platinum: { name: 'speedometer', library: 'Ionicons' }
    }
};
```

### Tier Color Schemes

```typescript
const TIER_COLORS = {
    bronze: {
        primary: '#CD7F32',
        light: '#E6A85C',
        dark: '#8B5A2B',
        glow: 'rgba(205, 127, 50, 0.3)'
    },
    silver: {
        primary: '#C0C0C0',
        light: '#E8E8E8',
        dark: '#808080',
        glow: 'rgba(192, 192, 192, 0.3)'
    },
    gold: {
        primary: '#FFD700',
        light: '#FFED4E',
        dark: '#B8860B',
        glow: 'rgba(255, 215, 0, 0.4)'
    },
    platinum: {
        primary: '#E5E4E2',
        light: '#FFFFFF',
        dark: '#A8A8A8',
        glow: 'rgba(229, 228, 226, 0.5)'
    }
};
```

## Error Handling

### Service Layer Errors

1. **Database Connection Failures**
   - Fallback to cached achievements
   - Queue achievement unlocks for later sync
   - Display cached user achievements

2. **Achievement Check Failures**
   - Log error with context (user_id, achievement_type)
   - Continue with other achievement checks
   - Retry on next trigger event

3. **Notification Failures**
   - Mark achievement as not notified
   - Retry notification on next app open
   - Show in "Recent Achievements" section

### UI Error States

1. **Loading State**: Skeleton screens for achievement cards
2. **Empty State**: "Start watching to unlock achievements" message
3. **Error State**: "Unable to load achievements" with retry button
4. **Offline State**: Show cached achievements with sync indicator

## Testing Strategy

### Unit Tests

1. **AchievementChecker Tests**
   - Test each achievement type calculation
   - Test edge cases (exactly at threshold, just below, just above)
   - Test with missing data (no episodes watched, no savings data)

2. **AchievementsService Tests**
   - Test caching logic
   - Test unlock detection
   - Test progress calculation
   - Test stats aggregation

3. **Component Tests**
   - Test trophy icon rendering for each tier
   - Test locked/unlocked state styling
   - Test progress bar calculations
   - Test notification animations

### Integration Tests

1. **Achievement Unlock Flow**
   - Mark episode as watched → Check achievements → Unlock detected → Notification shown
   - Complete show → Check completions → Unlock detected → Database updated

2. **Progress Tracking**
   - Watch episodes → Progress updated → UI reflects changes
   - Break streak → Streak reset → UI shows reset

3. **Sync and Offline**
   - Unlock achievement offline → Queue for sync → Sync when online
   - Load achievements offline → Show cached data → Sync when online

### Manual Testing Checklist

- [ ] All achievement icons render correctly
- [ ] Tier colors display properly for each achievement
- [ ] Progress bars animate smoothly
- [ ] Unlock notifications appear with animations
- [ ] Achievement details modal shows correct information
- [ ] Stats card calculates percentages correctly
- [ ] Category filtering works
- [ ] Pull-to-refresh updates data
- [ ] Offline mode shows cached achievements
- [ ] Achievements sync after coming online

## Performance Considerations

### Optimization Strategies

1. **Caching**
   - Cache achievement definitions in AsyncStorage (rarely change)
   - Cache user achievements locally
   - Invalidate cache on unlock events

2. **Lazy Loading**
   - Load achievement details on demand (modal open)
   - Paginate achievement list if count exceeds 50

3. **Batch Operations**
   - Check multiple achievements in single database query
   - Batch update progress for multiple achievements

4. **Debouncing**
   - Debounce achievement checks on rapid episode marking
   - Check achievements max once per minute per user

5. **Icon Optimization**
   - Use vector icons (Ionicons) for scalability
   - Preload common trophy icons
   - Cache rendered icon components

### Database Indexing

- Index on `user_achievements.user_id` for fast user lookups
- Index on `achievement_progress.user_id` for progress queries
- Index on `achievements.category` for filtered queries
- Index on `user_achievements.unlocked_at` for recent achievements

## Achievement Notification System

### Notification Flow

```
User Action (Episode Watched)
    ↓
Achievement Check Triggered
    ↓
Achievement Unlocked Detected
    ↓
Save to user_achievements (notification_shown = false)
    ↓
Check Notification Preferences
    ↓
┌─────────────────────────────────────┐
│  In-App Notification Decision       │
├─────────────────────────────────────┤
│ • Full Screen: High-tier (Gold/Plat)│
│ • Banner: Lower-tier (Bronze/Silver)│
│ • Queue if multiple unlocks         │
└─────────────────────────────────────┘
    ↓
Display Notification with Animation
    ↓
Mark notification_shown = true
    ↓
Send Push Notification (if enabled)
    ↓
Mark push_sent = true
```

### Display Strategy

**Full-Screen Unlock Screen:**
- Triggered for Gold and Platinum achievements
- Triggered for first achievement ever
- Triggered for milestone achievements (every 5th unlock)
- Blocks user interaction until dismissed
- Maximum visual impact with animations

**Banner Notification:**
- Triggered for Bronze and Silver achievements
- Non-intrusive, appears at top
- Auto-dismisses after 5 seconds
- Can be tapped to expand to full screen
- Multiple banners queue sequentially

**Push Notifications:**
- Sent when app is in background
- Sent for all achievement unlocks (if enabled)
- Respects quiet hours from notification preferences
- Deep links to achievements screen
- Shows trophy emoji in notification

### Notification Queue Management

```typescript
class NotificationQueueManager {
    private queue: AchievementNotificationQueue[] = [];
    private isDisplaying: boolean = false;
    
    async addToQueue(achievement: Achievement): Promise<void> {
        // Add to queue with timestamp
        // Sort by tier priority (Platinum > Gold > Silver > Bronze)
    }
    
    async processQueue(): Promise<void> {
        // Display one notification at a time
        // Wait for user dismissal before showing next
        // Batch similar-tier achievements if >3 in queue
    }
    
    async clearQueue(): Promise<void> {
        // Clear all pending notifications
    }
}
```

### Animation Library

Use `react-native-reanimated` for smooth animations:
- Trophy scale and bounce
- Confetti particles
- Glow effects
- Counter animations

Use `lottie-react-native` for complex animations (optional):
- Trophy shine effect
- Particle explosions
- Tier-specific celebration animations

### Sound Effects

Optional sound effects for achievement unlocks:
- Bronze: Light chime
- Silver: Medium bell
- Gold: Triumphant fanfare
- Platinum: Epic orchestral hit

Use `expo-av` for audio playback with volume control.

### Haptic Feedback

Use `expo-haptics` for tactile feedback:
- Bronze: Light impact
- Silver: Medium impact
- Gold: Heavy impact
- Platinum: Success notification pattern

## Integration Points

### Existing Services

1. **progressService**
   - Hook into `markEpisodeWatched()` to trigger achievement checks
   - Query `getAllShowsProgress()` for completion achievements
   - Use episode_progress table for total episode counts

2. **user_impact_stats**
   - Query `total_savings` for savings achievements
   - Query `monthly_efficiency` for efficiency achievements
   - Query `current_streak` for streak achievements

3. **user_activity_tracking**
   - Query `total_episodes_watched` as alternative source
   - Query `last_episode_watched` for streak calculations
   - Use for engagement-based achievements (future)

4. **notificationService**
   - Send push notifications for achievement unlocks
   - Respect quiet hours settings
   - Use achievement notification preferences

### New Hooks

Add achievement checks to:
- `progressService.markEpisodeWatched()` → Check viewing + streak achievements
- `progressService.updateShowProgressLocal()` → Check completion achievements
- Impact stats update (future) → Check savings + efficiency achievements
- Daily background task → Check streak achievements

## Migration and Seeding

### Initial Setup

1. Create database tables (achievements, user_achievements, achievement_progress)
2. Seed achievements table with predefined achievements
3. Run migration to calculate existing user progress
4. Backfill user_achievements for already-met criteria

### Seed Data Script

```sql
-- Insert all predefined achievements
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('first_steps', 'First Steps', 'Watch your first episode', 'viewing', 'bronze', 'trophy-outline', 'Ionicons', '{"type": "episode_count", "value": 1}', 10, 1),
('getting_started', 'Getting Started', 'Watch 10 episodes', 'viewing', 'bronze', 'trophy-outline', 'Ionicons', '{"type": "episode_count", "value": 10}', 20, 2),
-- ... (continue for all achievements)
```

### Backfill Script

```typescript
async function backfillUserAchievements() {
    // For each user
    // Calculate current progress
    // Unlock achievements that meet criteria
    // Insert into user_achievements
}
```

## Future Enhancements

1. **Social Features**
   - Compare achievements with friends
   - Leaderboards by points
   - Share achievement unlocks

2. **Seasonal Achievements**
   - Limited-time achievements
   - Holiday-themed trophies
   - Special event achievements

3. **Hidden Achievements**
   - Secret achievements with ??? description
   - Unlock through special actions

4. **Achievement Rewards**
   - Unlock profile badges
   - Unlock custom themes
   - Unlock premium features

5. **Advanced Analytics**
   - Achievement unlock rate analytics
   - Rarity calculations based on user base
   - Trending achievements
