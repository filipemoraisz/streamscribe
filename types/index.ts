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