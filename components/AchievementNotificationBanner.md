# AchievementNotificationBanner Component

## Overview

The `AchievementNotificationBanner` is a compact, non-intrusive notification component that displays achievement unlocks as a banner sliding from the top of the screen. It serves as an alternative to the full-screen `AchievementUnlockScreen` for lower-tier achievements (Bronze/Silver) or when a less disruptive notification is preferred.

## Features

✅ **Compact banner design** - Slides down from top of screen  
✅ **Trophy icon with tier colors** - Visual representation with glow effect  
✅ **Tier badge display** - Shows Bronze/Silver/Gold/Platinum badge  
✅ **Auto-dismiss** - Automatically dismisses after 5 seconds  
✅ **Tap to expand** - Opens full unlock screen on tap  
✅ **Swipe-up gesture** - Manual dismissal via swipe gesture  
✅ **Queue support** - Handles multiple achievements sequentially  
✅ **Smooth animations** - Spring physics for natural feel  

## Component API

### Props

```typescript
interface AchievementNotificationBannerProps {
  achievement: Achievement | null;  // The achievement to display
  visible: boolean;                 // Controls visibility
  onDismiss: () => void;           // Called when banner is dismissed
  onPress: () => void;             // Called when banner is tapped (expand to full screen)
}
```

### Achievement Type

```typescript
interface Achievement {
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
```

## Hook API

### useAchievementNotificationBanner()

A custom hook for managing the notification banner queue.

```typescript
const {
  currentAchievement,    // Currently displayed achievement
  isVisible,             // Banner visibility state
  showNotification,      // Function to show a new notification
  dismissNotification,   // Function to dismiss current notification
  expandToFullScreen,    // Function to expand to full screen
  clearQueue,           // Function to clear all queued notifications
  queueLength,          // Number of notifications in queue
} = useAchievementNotificationBanner();
```

## Usage Examples

### Basic Usage

```tsx
import { AchievementNotificationBanner, useAchievementNotificationBanner } from './components';

function MyApp() {
  const {
    currentAchievement,
    isVisible,
    showNotification,
    dismissNotification,
    expandToFullScreen,
  } = useAchievementNotificationBanner();

  const [showFullScreen, setShowFullScreen] = useState(false);

  const handleExpandToFullScreen = () => {
    if (currentAchievement) {
      setShowFullScreen(true);
      expandToFullScreen();
    }
  };

  return (
    <>
      <AchievementNotificationBanner
        achievement={currentAchievement}
        visible={isVisible}
        onDismiss={dismissNotification}
        onPress={handleExpandToFullScreen}
      />
      
      {/* Your app content */}
    </>
  );
}
```

### Showing a Notification

```tsx
// When an achievement is unlocked
const achievement = {
  id: '1',
  achievement_key: 'first_steps',
  name: 'First Steps',
  description: 'Watch your first episode',
  category: 'viewing',
  tier: 'bronze',
  icon_name: 'trophy-outline',
  icon_library: 'Ionicons',
  unlock_criteria: { type: 'episode_count', value: 1 },
  points: 10,
  sort_order: 1,
};

showNotification(achievement);
```

### Queue Management

```tsx
// Show multiple achievements (they will queue automatically)
achievements.forEach(achievement => {
  showNotification(achievement);
});

// Clear all pending notifications
clearQueue();

// Check queue length
console.log(`${queueLength} notifications pending`);
```

### Integration with Full Screen

```tsx
function AchievementSystem() {
  const {
    currentAchievement,
    isVisible,
    showNotification,
    dismissNotification,
    expandToFullScreen,
  } = useAchievementNotificationBanner();

  const [fullScreenAchievement, setFullScreenAchievement] = useState(null);
  const [showFullScreen, setShowFullScreen] = useState(false);

  const handleExpandToFullScreen = () => {
    if (currentAchievement) {
      setFullScreenAchievement(currentAchievement);
      setShowFullScreen(true);
      expandToFullScreen(); // Dismisses banner
    }
  };

  const handleCloseFullScreen = () => {
    setShowFullScreen(false);
    setFullScreenAchievement(null);
  };

  return (
    <>
      {/* Banner for quick notifications */}
      <AchievementNotificationBanner
        achievement={currentAchievement}
        visible={isVisible}
        onDismiss={dismissNotification}
        onPress={handleExpandToFullScreen}
      />

      {/* Full screen for detailed view */}
      {fullScreenAchievement && (
        <AchievementUnlockScreen
          achievement={fullScreenAchievement}
          visible={showFullScreen}
          onClose={handleCloseFullScreen}
        />
      )}
    </>
  );
}
```

## Styling

The component uses tier-specific colors from the `TIER_COLORS` constant:

### Tier Colors

- **Bronze**: `#CD7F32` (primary), `#E6A85C` (light), `#8B5A2B` (dark)
- **Silver**: `#C0C0C0` (primary), `#E8E8E8` (light), `#808080` (dark)
- **Gold**: `#FFD700` (primary), `#FFED4E` (light), `#B8860B` (dark)
- **Platinum**: `#E5E4E2` (primary), `#FFFFFF` (light), `#A8A8A8` (dark)

### Customization

The component uses the app's design system tokens:
- `BrandTokens` for colors
- `Typography` for text styles
- `Spacing` for consistent spacing
- `BorderRadius` for rounded corners
- `Shadows` for elevation

## Animations

### Slide-in Animation
- Duration: 300ms
- Easing: Spring (damping: 15, stiffness: 150)
- Direction: Top to bottom

### Slide-out Animation
- Duration: 250ms
- Easing: Linear timing
- Direction: Bottom to top

### Auto-dismiss
- Delay: 5000ms (5 seconds)
- Can be interrupted by user interaction

## Gestures

### Swipe Up to Dismiss
- Threshold: 50px upward swipe
- Feedback: Springs back if threshold not met
- Result: Dismisses banner and calls `onDismiss`

### Tap to Expand
- Action: Tap anywhere on banner
- Result: Calls `onPress` to expand to full screen
- Clears auto-dismiss timer

## Queue Behavior

1. **Sequential Display**: Notifications are shown one at a time
2. **FIFO Order**: First notification added is first to display
3. **Auto-advance**: Next notification shows after current dismisses
4. **No Interruption**: Current notification completes before next shows
5. **Clear All**: `clearQueue()` removes all pending notifications

## Accessibility

- **Touch Targets**: Dismiss button has 10px hit slop for easier tapping
- **Readable Text**: Uses app typography system for consistency
- **Color Contrast**: Tier colors provide sufficient contrast
- **Gesture Alternative**: Both swipe and button dismiss options

## Performance Considerations

- **Native Driver**: All animations use native driver for 60fps
- **Minimal Re-renders**: Uses refs for animation values
- **Efficient Queue**: Queue managed with React state
- **Timer Cleanup**: Auto-dismiss timers properly cleaned up

## Requirements Satisfied

✅ **7.1**: In-app notification display  
✅ **7.2**: Optional notification types (banner vs full screen)  
✅ **7.3**: Celebratory visual effects (glow, tier colors)  
✅ **7.5**: Navigation to achievements screen (via onPress)  
✅ **8.8**: Trophy icon rendering  
✅ **8.9**: Tier-specific styling  
✅ **9.2**: Tier visual distinction  

## Related Components

- **AchievementUnlockScreen**: Full-screen achievement celebration
- **AchievementCard**: Achievement display in list/grid
- **InAppNotificationBanner**: General notification banner (different use case)

## Testing

See `AchievementNotificationBanner.example.tsx` for interactive examples and test scenarios.

## Notes

- Banner appears at top of screen with status bar padding
- Z-index of 1000 ensures it appears above most content
- Works with all achievement tiers (bronze, silver, gold, platinum)
- Integrates seamlessly with existing notification system
- Can be used standalone or with full unlock screen
