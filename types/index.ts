export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  original_title: string;
  popularity: number;
  video: boolean;
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  original_name: string;
  popularity: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface StreamingService {
  id: string;
  name: string;
  homePage?: string;
  themeColorCode?: string;
  imageSet?: {
    lightThemeImage: string;
    darkThemeImage: string;
    whiteImage: string;
  };
}

export interface StreamingOption {
  service: StreamingService;
  type: 'flatrate' | 'buy' | 'rent' | 'free';
  quality?: string;
  price?: {
    amount: string;
    currency: string;
    formatted: string;
  };
  link: string;
}

// TMDB Watch Providers types
export interface TMDBWatchProvider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

export interface TMDBWatchProviders {
  link: string;
  flatrate?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: {
    [countryCode: string]: TMDBWatchProviders;
  };
}

export interface WatchlistItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  added_date: string;
  watched: boolean;
  rewatch_count?: number;
  providerCache?: {
    timestamp: number;
    data: StreamingOption[];
    source: 'tmdb' | 'rapidapi';
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  profileImage?: string | null;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface Season {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episode_count: number;
  air_date: string;
  poster_path: string | null;
  episodes?: Episode[];
}

export interface TVShowDetails extends TVShow {
  seasons: Season[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  type: string;
  last_air_date: string;
  next_episode_to_air?: Episode;
  last_episode_to_air?: Episode;
}

export interface EpisodeProgress {
  id: string; // unique identifier
  user_id: string;
  show_id: number;
  season_number: number;
  episode_number: number;
  watched: boolean;
  watched_date?: string;
  rating?: number; // 1-10 user rating
}

export interface ShowProgress {
  id: string;
  user_id: string;
  show_id: number;
  current_season: number;
  current_episode: number;
  total_watched_episodes: number;
  last_watched_date: string;
  status: 'watching' | 'completed' | 'dropped' | 'plan_to_watch' | 'up_to_date';
}

export interface UserPreferences {
  user_id: string;
  subscribed_services: string[];
  weekly_watch_hours: number;
  monthly_budget: number;
  updated_at: string;
  onboarding_completed?: boolean; // Optional flag
}

export interface UserImpactStats {
  user_id: string;
  total_savings: number;
  optimized_hours: number;
  current_streak: number;
  monthly_efficiency: number;
  last_updated: string;
}

// Real-time types
export interface RealTimeUpdate {
  id: string;
  type: 'progress' | 'watchlist' | 'episode_release' | 'streaming_availability';
  userId: string;
  timestamp: string;
  data: any;
}

export interface ProgressUpdate extends RealTimeUpdate {
  type: 'progress';
  data: {
    showId: number;
    seasonNumber: number;
    episodeNumber: number;
    watched: boolean;
    deviceId: string;
  };
}

export interface WatchlistUpdate extends RealTimeUpdate {
  type: 'watchlist';
  data: {
    action: 'add' | 'remove' | 'update';
    item: WatchlistItem;
  };
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected?: string;
  reconnectAttempts: number;
}

export interface SyncAction {
  id: string;
  type: 'progress_update' | 'watchlist_change' | 'preference_update' | 'real_time_progress' | 'real_time_watchlist' | 'streaming_availability_update' | 'episode_release_update';
  payload: any;
  timestamp: string;
  retryCount: number;
  deviceId: string;
  priority: 'high' | 'normal' | 'low';
  batchId?: string;
  conflictResolution?: 'last_write_wins' | 'merge' | 'manual';
  originalTimestamp?: string; // For conflict detection
}

export interface QueueStatus {
  pendingActions: number;
  lastSyncTime: string;
  isProcessing: boolean;
  errors: SyncError[];
}

export interface SyncError {
  id: string;
  action: SyncAction;
  error: string;
  timestamp: string;
}

export interface SyncResult {
  processed: number;
  failed: number;
  conflicts: ConflictResolution[];
}

export interface ConflictResolution {
  actionId: string;
  conflictingActionId?: string;
  resolution: 'local_wins' | 'remote_wins' | 'merged';
  details: string;
  timestamp: string;
  deviceIds: string[];
}

// Notification types
export interface NotificationPayload {
  id: string;
  type: 'episode_release' | 'streaming_availability' | 'recommendation' | 'progress_sync';
  title: string;
  body: string;
  data: Record<string, any>;
  scheduledFor?: string;
  priority: 'high' | 'normal' | 'low';
}

export interface NotificationPreferences {
  userId: string;
  episodeReleases: boolean;
  streamingUpdates: boolean;
  recommendations: boolean;
  progressSync: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  frequency: 'immediate' | 'daily' | 'weekly';
  updatedAt: string;
}

export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  trigger?: {
    seconds?: number;
    date?: Date;
  };
}

// Enhanced sync queue types
export interface SyncBatch {
  id: string;
  actions: SyncAction[];
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  deviceId: string;
}

export interface DeviceActionTracker {
  deviceId: string;
  lastSyncTime: string;
  pendingActions: number;
  conflictCount: number;
  successfulSyncs: number;
  failedSyncs: number;
}

export interface OptimisticUpdate {
  id: string;
  actionId: string;
  type: 'progress' | 'watchlist' | 'preference';
  originalData: any;
  optimisticData: any;
  timestamp: string;
  applied: boolean;
}

export interface RollbackOperation {
  id: string;
  optimisticUpdateId: string;
  reason: 'sync_failed' | 'conflict_detected' | 'manual_rollback';
  timestamp: string;
  rollbackData: any;
}

// Achievement System Types

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementCategory = 'viewing' | 'streaks' | 'completions' | 'savings' | 'efficiency';
export type IconLibrary = 'Ionicons' | 'MaterialCommunityIcons' | 'FontAwesome';

export interface UnlockCriteria {
  type: 'episode_count' | 'streak_days' | 'show_completions' | 'total_savings' | 'monthly_efficiency';
  value: number;
  comparison?: 'gte' | 'lte' | 'eq'; // greater than or equal, less than or equal, equal
}

export interface Achievement {
  id: string;
  achievement_key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon_name: string;
  icon_library: IconLibrary;
  unlock_criteria: UnlockCriteria;
  points: number;
  sort_order: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement; // Joined data
  unlocked_at: string;
  progress_value?: number;
  notified: boolean;
}

export interface AchievementProgress {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  current_value: number;
  target_value: number;
  last_updated: string;
  progress_percentage: number; // Calculated: (current_value / target_value) * 100
}

export interface AchievementStats {
  total_unlocked: number;
  total_available: number;
  completion_percentage: number;
  total_points: number;
  by_tier: {
    bronze: { unlocked: number; total: number };
    silver: { unlocked: number; total: number };
    gold: { unlocked: number; total: number };
    platinum: { unlocked: number; total: number };
  };
  recent_achievements: UserAchievement[];
  close_to_unlock: AchievementProgress[]; // >75% progress
}

export interface AchievementNotificationPreferences {
  user_id: string;
  in_app_full_screen: boolean; // Show full unlock screen
  in_app_banner: boolean; // Show compact banner
  push_notifications: boolean; // Send push notifications
  sound_enabled: boolean; // Play sound on unlock
  haptic_enabled: boolean; // Vibrate on unlock
  progress_reminders: boolean; // Notify when close to unlock (>90%)
  created_at: string;
  updated_at: string;
}

export interface AchievementNotificationQueue {
  id: string;
  achievement: Achievement;
  timestamp: string;
  displayed: boolean;
  displayMode: 'full_screen' | 'banner';
}

// Achievement Constants

export const TIER_COLORS = {
  bronze: {
    primary: '#CD7F32',
    light: '#E6A85C',
    dark: '#8B5A2B',
    glow: 'rgba(205, 127, 50, 0.3)'
  },
  silver: {
    primary: '#C0C0C0',
    light: '#E8E8E8',
    dark: '#808080',
    glow: 'rgba(192, 192, 192, 0.3)'
  },
  gold: {
    primary: '#FFD700',
    light: '#FFED4E',
    dark: '#B8860B',
    glow: 'rgba(255, 215, 0, 0.4)'
  },
  platinum: {
    primary: '#E5E4E2',
    light: '#FFFFFF',
    dark: '#A8A8A8',
    glow: 'rgba(229, 228, 226, 0.5)'
  }
} as const;

export const ACHIEVEMENT_ICONS = {
  viewing: {
    bronze: { name: 'trophy-outline', library: 'Ionicons' as IconLibrary },
    silver: { name: 'trophy', library: 'Ionicons' as IconLibrary },
    gold: { name: 'trophy', library: 'Ionicons' as IconLibrary },
    platinum: { name: 'trophy', library: 'Ionicons' as IconLibrary }
  },
  streaks: {
    bronze: { name: 'flame-outline', library: 'Ionicons' as IconLibrary },
    silver: { name: 'flame', library: 'Ionicons' as IconLibrary },
    gold: { name: 'flame', library: 'Ionicons' as IconLibrary },
    platinum: { name: 'flame', library: 'Ionicons' as IconLibrary }
  },
  completions: {
    bronze: { name: 'star-outline', library: 'Ionicons' as IconLibrary },
    silver: { name: 'star', library: 'Ionicons' as IconLibrary },
    gold: { name: 'star', library: 'Ionicons' as IconLibrary },
    platinum: { name: 'star', library: 'Ionicons' as IconLibrary }
  },
  savings: {
    bronze: { name: 'cash-outline', library: 'Ionicons' as IconLibrary },
    silver: { name: 'cash', library: 'Ionicons' as IconLibrary },
    gold: { name: 'cash', library: 'Ionicons' as IconLibrary },
    platinum: { name: 'cash', library: 'Ionicons' as IconLibrary }
  },
  efficiency: {
    bronze: { name: 'speedometer-outline', library: 'Ionicons' as IconLibrary },
    silver: { name: 'speedometer', library: 'Ionicons' as IconLibrary },
    gold: { name: 'speedometer', library: 'Ionicons' as IconLibrary },
    platinum: { name: 'speedometer', library: 'Ionicons' as IconLibrary }
  }
} as const;

// Profile Redesign Types

export interface UserStats {
  // Streak data
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  
  // Viewing data
  totalEpisodes: number;
  totalHoursWatched: number;
  showsCompleted: number;
  
  // Achievement data
  achievementPoints: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  
  // Impact data (future)
  totalSavings: number;
  optimizedHours: number;
  monthlyEfficiency: number;
}

export interface UserActivityTracking {
  user_id: string;
  last_app_open: string | null;
  last_episode_watched: string | null;
  last_watchlist_update: string | null;
  total_app_opens: number;
  total_episodes_watched: number;
  total_watchlist_updates: number;
  total_hours_watched: number;
  average_session_length: number;
  preferred_watch_time: string | null;
  weekly_watch_pattern: number[];
  engagement_score: number;
  current_streak: number;
  longest_streak: number;
  last_streak_date: string | null;
  total_savings: number;
  monthly_efficiency: number;
  optimized_hours: number;
  created_at: string;
  updated_at: string;
}

export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge?: number; // Optional notification badge
}

// Start Watching Widget Types

export interface RecommendationItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  providerName: string;
  providerLogoUrl?: string;
  source: 'watchlist' | 'taste';
  tasteScore?: number;
  genres?: number[];
}

export interface GenreScore {
  genreId: number;
  genreName: string;
  count: number;
  avgRating: number;
}

export interface TasteProfile {
  userId: string;
  favoriteGenres: GenreScore[];
  averageRating: number;
  contentTypePreference: {
    movie: number;
    tv: number;
  };
  watchFrequency: {
    moviesPerWeek: number;
    episodesPerWeek: number;
  };
  recentlyWatched: number[];
  preferredProviders: string[];
}

export interface SwipeAction {
  type: 'watched' | 'dismissed' | 'removed';
  itemId: number;
  timestamp: string;
}

export interface RecommendationQueue {
  watchlistItems: RecommendationItem[];
  tasteItems: RecommendationItem[];
  currentPhase: 'watchlist' | 'taste';
  dismissedIds: Set<string>;
}

// Home Screen Enhancement Types

export interface BecauseYouWatchedSection {
  sourceId: number;
  sourceTitle: string;
  sourceType: 'movie' | 'tv';
  items: (Movie | TVShow)[];
}

export interface GenreSection {
  genreId: number;
  genreName: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
}

export interface LeavingSoonItem extends Partial<Movie>, Partial<TVShow> {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  departureDate: string; // ISO date
  providerName: string;
  providerLogoUrl?: string;
  daysRemaining: number;
  isInWatchlist?: boolean;
}
