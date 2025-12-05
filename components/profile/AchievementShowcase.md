# AchievementShowcase Component

## Overview

The `AchievementShowcase` component is a comprehensive display for user achievements in the profile screen. It integrates the existing `AchievementStatsCard` and adds a new `FeaturedAchievements` section that highlights recent unlocks and achievements close to completion.

## Components

### AchievementShowcase

Main container component that orchestrates the achievement display.

**Props:**
- `userId: string` - The user ID to load achievements for
- `onRefresh?: () => void` - Optional callback when data is refreshed

**Features:**
- Loads achievement stats from `achievementsService`
- Displays loading and error states
- Provides refresh capability
- Integrates both stats card and featured achievements

### FeaturedAchievements

Horizontal scrollable list of featured achievements.

**Props:**
- `userId: string` - The user ID to load achievements for

**Features:**
- Shows last 3 recent unlocks
- Shows up to 3 achievements close to unlock (>75% progress)
- Horizontal snap scrolling
- Opens detail modal on card press
- Empty state for new users

### FeaturedAchievementCard

Individual achievement card for the featured list.

**Props:**
- `achievement: Achievement` - The achievement data
- `userAchievement?: UserAchievement` - User's unlock data (if unlocked)
- `progress?: AchievementProgress` - Progress data (if locked)
- `onPress: () => void` - Press handler

**Features:**
- Displays achievement icon with tier-based colors
- Shows progress bar for locked achievements
- Shows unlock badge for unlocked achievements
- Displays points value
- Tier-based border colors

## Usage

### In Profile Screen

```tsx
import { AchievementShowcase } from '../../components/profile/AchievementShowcase';

// Inside your component
<AchievementShowcase 
  userId={user.id}
  onRefresh={() => {
    // Optional: Handle refresh completion
    console.log('Achievements refreshed');
  }}
/>
```

### Standalone FeaturedAchievements

```tsx
import { FeaturedAchievements } from '../../components/profile/FeaturedAchievements';

<FeaturedAchievements userId={user.id} />
```

## Data Flow

1. **AchievementShowcase** loads stats via `achievementsService.getAchievementStats()`
2. **FeaturedAchievements** also loads stats to get recent and close-to-unlock achievements
3. **FeaturedAchievementCard** displays individual achievement with appropriate styling
4. Pressing a card opens **AchievementDetailModal** with full details

## Styling

All components follow the profile redesign color scheme:
- Background: `Colors.card` (#1A1A1A)
- Border: `Colors.border` (#333333)
- Text: `Colors.text` (white) and `Colors.textSecondary` (#CCCCCC)
- Accent: Tier-based colors from `TIER_COLORS`

## Requirements Satisfied

- **3.1**: Achievement badges displayed with orange accents
- **3.2**: Orange badges for unlocked, gray for locked
- **3.3**: Achievement details on tap
- **3.4**: Recent unlocks and close-to-unlock achievements shown
- **3.5**: Progress toward unlocking displayed

## Integration Points

- Uses existing `AchievementStatsCard` component
- Uses existing `AchievementDetailModal` for details
- Uses existing `achievementsService` for data
- Follows existing color scheme from `Colors` constants
- Uses tier colors from `TIER_COLORS` constant
