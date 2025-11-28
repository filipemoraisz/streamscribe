// Core Services
export { progressService } from './progress';
export { storageService } from './storage';
export { tmdbService } from './tmdb';
export { realTimeManager } from './realtime';
export { notificationManager } from './notifications';
export { notificationPermissionService } from './notificationPermissions';
export { notificationSyncService } from './notificationSync';

// Recommendation Service
export { recommendationService } from './recommendations';
export type { MonthlyRecommendation, ProviderRecommendation } from './recommendations';

// Types (re-export for convenience)
export type {
    Episode, EpisodeProgress, Movie, Season,
    ShowProgress, StreamingOption, TVShow,
    TVShowDetails, User, WatchlistItem,
    NotificationPayload, NotificationPreferences, LocalNotification
} from '../types';
