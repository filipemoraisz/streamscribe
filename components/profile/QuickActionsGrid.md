# QuickActionsGrid Component

A 2x2 grid layout component that provides quick access to key features from the profile screen.

## Features

- **2x2 Grid Layout**: Four action cards with equal sizing and spacing
- **Dark Surface Background**: Matches the profile redesign aesthetic
- **Orange Icons**: 32px icons in the primary orange color
- **Haptic Feedback**: Light impact feedback on press
- **Press States**: Orange border highlight on active press
- **Badge Support**: Optional notification badges in top-right corner
- **Accessibility**: Full screen reader support with labels and hints

## Usage

### Basic Usage

```tsx
import { QuickActionsGrid, QUICK_ACTIONS } from '@/components';
import { useRouter } from 'expo-router';

function ProfileScreen() {
  const router = useRouter();

  const handleActionPress = (action: QuickAction) => {
    router.push(action.route as any);
  };

  return (
    <QuickActionsGrid
      actions={QUICK_ACTIONS}
      onActionPress={handleActionPress}
    />
  );
}
```

### With Notification Badge

```tsx
import { QuickActionsGrid, QUICK_ACTIONS } from '@/components';
import { useRouter } from 'expo-router';

function ProfileScreen() {
  const router = useRouter();
  const unreadCount = 5; // From your notification service

  const actionsWithBadge = QUICK_ACTIONS.map(action => 
    action.id === 'notifications' 
      ? { ...action, badge: unreadCount }
      : action
  );

  const handleActionPress = (action: QuickAction) => {
    router.push(action.route as any);
  };

  return (
    <QuickActionsGrid
      actions={actionsWithBadge}
      onActionPress={handleActionPress}
    />
  );
}
```

### Custom Actions

```tsx
import { QuickActionsGrid, QuickAction } from '@/components';

const customActions: QuickAction[] = [
  {
    id: 'settings',
    icon: 'settings',
    label: 'Settings',
    route: '/settings',
  },
  {
    id: 'help',
    icon: 'help-circle',
    label: 'Help',
    route: '/help',
  },
  // ... more actions
];

<QuickActionsGrid
  actions={customActions}
  onActionPress={handleActionPress}
/>
```

## Props

### QuickActionsGrid

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `QuickAction[]` | Yes | Array of quick action configurations |
| `onActionPress` | `(action: QuickAction) => void` | Yes | Callback when an action is pressed |

### QuickAction

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the action |
| `icon` | `keyof typeof Ionicons.glyphMap` | Yes | Ionicons icon name |
| `label` | `string` | Yes | Display label below the icon |
| `route` | `string` | Yes | Navigation route path |
| `badge` | `number` | No | Optional badge count (e.g., unread notifications) |

## Default Actions

The component comes with a predefined set of actions in `QUICK_ACTIONS`:

1. **Notifications** - Navigate to notification settings
2. **Achievements** - Navigate to achievement settings
3. **Connection** - Navigate to connection test
4. **History** - Navigate to viewing history

## Styling

The component uses the following design tokens:

- **Background**: `Colors.surface` (#1A1A1A)
- **Border**: `Colors.border` (#333333)
- **Icon Color**: `Colors.primary` (#FF6600)
- **Text Color**: `Colors.text` (#FFFFFF)
- **Badge Background**: `Colors.primary` (#FF6600)

## Accessibility

Each action card includes:
- `accessibilityLabel`: The action label
- `accessibilityRole`: "button"
- `accessibilityHint`: Navigation hint

## Haptic Feedback

Uses `Haptics.ImpactFeedbackStyle.Light` on press for tactile feedback.

## Layout

- **Grid**: 2x2 layout with 12px gap
- **Card Size**: 48% width with 1:1 aspect ratio
- **Icon Size**: 32px
- **Border Radius**: 16px
- **Padding**: 16px

## Requirements Satisfied

- ✅ 4.1: Card-based layout with orange icons
- ✅ 4.2: Navigation to appropriate screens
- ✅ 4.3: Wired up routes for all actions
- ✅ 4.4: Press state with orange border
- ✅ 4.5: Optional badge indicators
- ✅ 6.3: Haptic feedback on press
- ✅ 8.1: Dark surface background and responsive layout
