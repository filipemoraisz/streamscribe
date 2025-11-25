# AR Store Gamification Design System

This directory contains the core UI components for the AR Store Gamification app, following a consistent brand design system.

## Brand Tokens

The design system is built on a foundation of brand tokens defined in `../../constants/BrandTokens.ts`:

### Colors
- **Primary Brand Colors**: Neon lime (`#B5FD1D`), Electric blue (`#1401FE`), Hot pink (`#F76DEF`)
- **Neutral Colors**: Dark gray (`#656565`), White (`#FEFEFE`), Input gray (`#E4E4E4`)
- **Accent Colors**: Purple (`#7D75FB`), Muted gray (`#9E9F9D`)
- **Semantic Colors**: Success, warning, and error states

### Typography
- **Brand Font**: Press Start 2P (pixel-style for logo/branding)
- **Heading Font**: Poppins (geometric sans-serif)
- **UI Font**: Inter (clean, readable interface text)

### Spacing
Follows an 8-point grid system (4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px)

## Components

### BrandCard
Rounded white card with brand styling and subtle shadow.

```tsx
import { BrandCard } from './components/design-system';

<BrandCard topRadius={true}>
  <Text>Card content</Text>
</BrandCard>
```

**Props:**
- `children`: React.ReactNode - Content to display inside the card
- `style?`: ViewStyle - Additional styling
- `topRadius?`: boolean - Whether to apply top-only border radius
- `testID?`: string - Test identifier

### BrandInput
Styled input field with focus animations and error states.

```tsx
import { BrandInput } from './components/design-system';

<BrandInput
  placeholder="Enter email"
  value={email}
  onChangeText={setEmail}
  label="Email Address"
  error={emailError}
  keyboardType="email-address"
/>
```

**Props:**
- `placeholder`: string - Placeholder text
- `value`: string - Current input value
- `onChangeText`: (text: string) => void - Change handler
- `secureTextEntry?`: boolean - Whether to hide text (for passwords)
- `keyboardType?`: KeyboardTypeOptions - Keyboard type
- `error?`: string - Error message to display
- `label?`: string - Input label
- `style?`: ViewStyle - Additional styling

**Features:**
- Focus animation with pink outline and card elevation
- Real-time error display
- Accessibility support

### PrimaryCTA
Primary call-to-action button with press animations and loading states.

```tsx
import { PrimaryCTA } from './components/design-system';

<PrimaryCTA
  title="Sign In"
  onPress={handleSignIn}
  loading={isLoading}
  disabled={!isFormValid}
/>
```

**Props:**
- `title`: string - Button text
- `onPress`: () => void - Press handler
- `disabled?`: boolean - Whether button is disabled
- `loading?`: boolean - Whether to show loading indicator
- `style?`: ViewStyle - Additional styling

**Features:**
- Scale animation on press
- Loading state with activity indicator
- Pink background with shadow
- Uppercase text styling

### AchievementBadge
Pill-shaped badge for displaying achievements, points, and level information.

```tsx
import { AchievementBadge } from './components/design-system';

<AchievementBadge
  text="Level Up!"
  icon="🏆"
  variant="success"
/>
```

**Props:**
- `text`: string - Badge text
- `icon?`: string - Icon/emoji to display
- `variant?`: 'success' | 'points' | 'level' - Visual variant
- `style?`: ViewStyle - Additional styling

**Variants:**
- `success`: Green background with white text
- `points`: Lime background with dark text
- `level`: Purple background with white text

## Font Setup

The design system uses custom fonts that need to be loaded:

```tsx
import { useAppFonts } from '../../constants/Fonts';

export default function App() {
  const fontsLoaded = useAppFonts();
  
  if (!fontsLoaded) {
    return <SplashScreen />;
  }
  
  return <YourApp />;
}
```

## Testing

All components include comprehensive test coverage:

```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

## Accessibility

All components follow WCAG 2.1 AA guidelines:
- Proper color contrast ratios
- Screen reader support with accessibility labels
- Minimum 44px touch targets
- Keyboard navigation support where applicable

## Animation Specifications

Components use consistent animation timing and easing:
- **Fast**: 150ms (micro-interactions)
- **Normal**: 220ms (focus states, transitions)
- **Slow**: 420ms (screen transitions)
- **Easing**: Cubic-bezier curves for natural motion