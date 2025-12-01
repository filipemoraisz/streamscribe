// Design System Components
// Design System Components
export { BrandCard } from './design-system';
export type { BrandCardProps } from './design-system';
export { BrandInput } from './design-system';
export type { BrandInputProps } from './design-system';
export { PrimaryCTA } from './design-system';
export type { PrimaryCTAProps } from './design-system';
export { UIAchievementBadge } from './design-system';
export type { UIAchievementBadgeProps } from './design-system';

// Recommendation Feature Components
export { ProviderDetailsModal } from './ProviderDetailsModal';
export { RecommendationBanner } from './RecommendationBanner';
export { RecommendationCard } from './RecommendationCard';

// Notification Components
export { NotificationPermissionModal } from './NotificationPermissionModal';
export { InAppNotificationBanner, useInAppNotifications } from './InAppNotificationBanner';

// Achievement Components
export { AchievementCard } from './AchievementCard';
export { AchievementUnlockScreen } from './AchievementUnlockScreen';
export { AchievementNotificationBanner, useAchievementNotificationBanner } from './AchievementNotificationBanner';
export { AchievementNotificationProvider } from './AchievementNotificationProvider';
export { default as AchievementDetailModal } from './AchievementDetailModal';
export { AchievementStatsCard } from './AchievementStatsCard';
export { AchievementBadge } from './AchievementBadge';

// Hooks
export { useNotificationPermissions, useNotificationPromptTrigger } from './hooks/useNotificationPermissions';
export { useAchievementNotifications } from './hooks/useAchievementNotifications';

// Existing Components
export { Logo } from './Logo';
export { MediaCard } from './MediaCard';
export { MediaSection } from './MediaSection';
export { SearchBar } from './SearchBar';
export { StreamingOptions } from './StreamingOptions';

// Home Screen Enhancement Components
export { EmptyState } from './EmptyState';
export { SkeletonLoader } from './SkeletonLoader';
export { ErrorState } from './ErrorState';
export { default as WelcomeModal } from './WelcomeModal';
export { ContinueWatchingSection } from './ContinueWatchingSection';
export { BecauseYouWatchedSection } from './BecauseYouWatchedSection';
export { GenreSection } from './GenreSection';
export { NewThisWeekSection } from './NewThisWeekSection';
export { LeavingSoonSection } from './LeavingSoonSection';
export { QuickFilters } from './QuickFilters';
export type { QuickFilterType } from './QuickFilters';
export { SurpriseButton } from './SurpriseButton';

// Types (re-export for convenience)
export type { MonthlyRecommendation, ProviderRecommendation } from '../services/recommendations';
export type { StreamingOption, WatchlistItem, NotificationPayload, NotificationPreferences, LocalNotification } from '../types';
export type { InAppNotification } from './InAppNotificationBanner';


// Profile Components
export { StatsGrid } from './profile/StatsGrid';
export { QuickActionsGrid } from './profile/QuickActionsGrid';
export type { QuickAction } from './profile/QuickActionsGrid';
export { QUICK_ACTIONS } from './profile/quickActionsConfig';
export { AchievementShowcase } from './profile/AchievementShowcase';
export { FeaturedAchievements } from './profile/FeaturedAchievements';
export { FeaturedAchievementCard } from './profile/FeaturedAchievementCard';
