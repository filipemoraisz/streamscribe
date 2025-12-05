# SurpriseButton Component

A prominent, engaging button component that triggers random content selection with animations and haptic feedback.

## Features

- **Prominent Design**: Uses primary brand color (#FF6600) with shadow effects
- **Loading State**: Shows spinner and "Finding..." text during selection
- **Haptic Feedback**: Medium impact haptic on press
- **Animations**: 
  - Scale animation on press (squeeze effect)
  - Continuous rotation animation on icon when idle
  - Smooth transitions between states
- **Accessibility**: Disabled state during loading to prevent multiple taps

## Props

```typescript
interface SurpriseButtonProps {
  onPress: () => void;    // Handler for button press
  loading?: boolean;      // Shows loading state (default: false)
}
```

## Usage

```tsx
import { SurpriseButton } from '@/components';

<SurpriseButton
  onPress={handleSurpriseMe}
  loading={surpriseLoading}
/>
```

## Visual States

### Idle State
```
┌─────────────────────────────┐
│  🔀  SURPRISE ME            │  ← Orange background (#FF6600)
└─────────────────────────────┘  ← Icon rotates slightly
```

### Loading State
```
┌─────────────────────────────┐
│  ⟳  Finding...              │  ← Spinner animation
└─────────────────────────────┘  ← Button disabled
```

### Pressed State
```
┌─────────────────────────────┐
│  🔀  SURPRISE ME            │  ← Scales down to 0.95
└─────────────────────────────┘  ← Then springs back to 1.0
                                  ← Haptic feedback triggers
```

## Requirements

Implements requirements:
- **8.1**: Show "Surprise Me" button in prominent location
- **8.5**: Provide haptic feedback on action completion

## Dependencies

- `expo-haptics`: For haptic feedback
- `react-native-reanimated`: For smooth animations
- `@expo/vector-icons`: For shuffle icon

## Animation Details

1. **Press Animation**: 
   - Scale: 1.0 → 0.95 → 1.0 (spring animation)
   - Duration: ~300ms total
   - Easing: Spring with damping 15, stiffness 300

2. **Idle Icon Animation**:
   - Rotation: 0° → -5° → 5° → 0° (repeating)
   - Duration: 300ms per cycle
   - Infinite loop when not loading

3. **Loading State**:
   - Icon rotation stops
   - Spinner appears with native animation
   - Button becomes disabled

## Styling

- **Background**: `Colors.primary` (#FF6600)
- **Text**: White, 18px, bold, uppercase
- **Padding**: 16px horizontal, 16px vertical
- **Border Radius**: 16px
- **Shadow**: Button shadow from design system
- **Icon Size**: 24px

## Integration Example

See `SurpriseButton.example.tsx` for a complete integration example with the home screen.
