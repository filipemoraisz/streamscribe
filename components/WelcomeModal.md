# WelcomeModal Component

A first-time user onboarding modal that displays feature highlights and integrates with the OnboardingService for persistent state management.

## Features

- **Feature Highlights**: Displays 4 key app features with icons and descriptions
- **Smooth Animations**: Entrance and exit animations using React Native Animated API
- **Persistent State**: Integrates with OnboardingService to show only once
- **Responsive Design**: Adapts to different screen sizes
- **Brand Consistent**: Uses BrandTokens for colors, typography, and spacing

## Props

```typescript
interface WelcomeModalProps {
  visible: boolean;        // Controls modal visibility
  onDismiss: () => void;   // Called when modal should be dismissed
  onGetStarted: () => void; // Called when "Get Started" button is pressed
}
```

## Usage

### Basic Integration

```tsx
import React, { useEffect, useState } from 'react';
import { WelcomeModal } from '../components';
import { onboardingService } from '../services/onboarding';

function HomeScreen() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    const hasSeenWelcome = await onboardingService.hasSeenWelcome();
    setShowWelcome(!hasSeenWelcome);
  };

  const handleGetStarted = async () => {
    await onboardingService.markWelcomeSeen();
    setShowWelcome(false);
  };

  return (
    <>
      <WelcomeModal
        visible={showWelcome}
        onDismiss={() => setShowWelcome(false)}
        onGetStarted={handleGetStarted}
      />
      {/* Your screen content */}
    </>
  );
}
```

## Feature Highlights

The modal displays the following features:

1. **Track Your Impact** - Streaming subscription optimization
2. **Build Your Watchlist** - Save content across services
3. **Smart Recommendations** - Personalized suggestions
4. **Unlock Achievements** - Earn badges and points

## Animations

The component includes three coordinated animations:

- **Fade In**: Overlay fades from transparent to opaque
- **Slide Up**: Modal slides up from below
- **Scale**: Modal scales from 0.9 to 1.0 for a subtle zoom effect

Exit animations reverse these effects for a smooth dismissal.

## Styling

The component uses the brand design system:

- **Colors**: BrandTokens (brandLime, ctaPink, accentPurple, brandBlue)
- **Typography**: Typography system (h1, h2, body, button)
- **Spacing**: 8pt grid system
- **Shadows**: Elevated shadow for depth

## OnboardingService Integration

The modal works with the OnboardingService which:

- Stores dismissal state in AsyncStorage
- Tracks onboarding version for future updates
- Provides methods to check and update onboarding status

```typescript
// Check if user has seen welcome
const hasSeenWelcome = await onboardingService.hasSeenWelcome();

// Mark welcome as seen
await onboardingService.markWelcomeSeen();

// Reset onboarding (for testing)
await onboardingService.resetOnboarding();
```

## Accessibility

- Modal can be dismissed with back button (Android)
- Touch outside overlay does not dismiss (intentional for first-time users)
- Clear visual hierarchy with proper contrast
- Scrollable content for smaller screens

## Requirements Validation

This component satisfies the following requirements:

- **11.1**: Displays welcome modal on first visit
- **11.2**: Shows feature highlights with descriptions
- **11.3**: Includes "Get Started" button
- **11.4**: Dismissal state persists via OnboardingService
- **11.5**: Never shows again after dismissal

## Testing

See `WelcomeModal.example.tsx` for a complete integration example.

To test the modal repeatedly during development:

```typescript
// Reset onboarding state
await onboardingService.resetOnboarding();
```
