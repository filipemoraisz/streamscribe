// Design System Components
export * from './design-system';

// Recommendation Feature Components
export { ProviderDetailsModal } from './ProviderDetailsModal';
export { RecommendationBanner } from './RecommendationBanner';
export { RecommendationCard } from './RecommendationCard';

// Notification Components
export { NotificationPermissionModal } from './NotificationPermissionModal';
export { InAppNotificationBanner, useInAppNotifications } from './InAppNotificationBanner';

// Hooks
export { useNotificationPermissions, useNotificationPromptTrigger } from './hooks/useNotificationPermissions';

// Existing Components
export { Logo } from './Logo';
export { MediaCard } from './MediaCard';
export { MediaSection } from './MediaSection';
export { SearchBar } from './SearchBar';
export { StreamingOptions } from './StreamingOptions';

// Types (re-export for convenience)
export type { MonthlyRecommendation, ProviderRecommendation } from '../services/recommendations';
export type { StreamingOption, WatchlistItem, NotificationPayload, NotificationPreferences, LocalNotification } from '../types';
export type { InAppNotification } from './InAppNotificationBanner';

