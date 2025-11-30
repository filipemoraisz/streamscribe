# AchievementBadge Component

A compact, tappable badge component that displays the user's achievement progress and provides quick navigation to the achievements screen.

## Features

- Displays total unlocked achievements vs. total available
- Shows a trophy icon with a badge count
- Displays the most recent achievement as a teaser (medium and large sizes)
- Three size variants: small, medium, and large
- Tappable to navigate to achievements screen
- Loading state with activity indicator
- Automatic data fetching on mount

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Size variant of the badge |
| `onPress` | `() => void` | `undefined` | Custom press handler (defaults to navigating to achievements screen) |

## Usage

### Basic Usage (Medium Size)

```tsx
import { AchievementBadge } from '@/components';

function MyScreen() {
  return <AchievementBadge />;
}
```

### Small Size

```tsx
<AchievementBadge size="small" />
```

### Large Size (Profile Screen)

```tsx
<AchievementBadge size="large" />
```

### Custom Press Handler

```tsx
<AchievementBadge 
  onPress={() => {
    console.log('Custom action');
    // Your custom logic here
  }} 
/>
```

## Size Variants

### Small
- Compact design for tight spaces
- Icon: 20px
- No recent achievement teaser
- Minimal padding

### Medium (Default)
- Balanced size for most use cases
- Icon: 24px
- Shows recent achievement teaser
- Standard padding

### Large
- Prominent display for profile/dashboard
- Icon: 32px
- Shows recent achievement teaser
- Generous padding

## Visual Elements

1. **Trophy Icon**: Gold trophy icon with size based on variant
2. **Badge Count**: Small circular badge showing total unlocked achievements
3. **Progress Text**: "X/Y Achievements" showing unlocked vs. total
4. **Recent Achievement**: "Latest: [Achievement Name]" (medium/large only)
5. **Chevron**: Right-pointing chevron indicating tappability

## Data Loading

The component automatically:
- Fetches achievement stats on mount
- Fetches user achievements to get recent unlocks
- Shows loading indicator while fetching
- Handles errors gracefully

## Integration

Currently integrated in:
- **Profile Screen**: Large size variant displayed prominently below stats

## Requirements Satisfied

- ✅ 8.1: Navigate to achievements screen
- ✅ 10.1: Display total achievements unlocked
- ✅ 10.7: Show recent achievement as teaser

## Styling

The component uses:
- Surface background with border
- Shadow for depth
- Gold trophy icon (#FFD700)
- Primary color for badge
- Responsive sizing based on variant

## Dependencies

- `@expo/vector-icons` (Ionicons)
- `expo-router` (navigation)
- `achievementsService` (data fetching)
- `useAuth` (user context)
