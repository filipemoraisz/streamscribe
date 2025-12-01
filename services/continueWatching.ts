import { progressService } from './progress';
import { tmdbService } from './tmdb';

export interface ContinueWatchingItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  
  // Progress information
  progress: number; // 0-100 percentage
  lastWatchedAt: string; // ISO date
  
  // TV-specific
  nextEpisode?: {
    season: number;
    episode: number;
    name: string;
  };
  
  // Movie-specific (not currently implemented)
  runtime?: number; // minutes
  watchedMinutes?: number;
}

/**
 * ContinueWatchingService
 * 
 * A lightweight service that formats and filters data from progressService
 * for the "Continue Watching" UI section. This service doesn't duplicate
 * data fetching logic - it leverages existing progress tracking.
 */
class ContinueWatchingService {
  /**
   * Get continue watching items for the current user
   * Fetches in-progress TV shows and partially watched movies
   * Sorted by most recently watched
   * 
   * This method uses progressService.getAllShowsProgress() which already:
   * - Queries episode_progress table for TV shows
   * - Caches data locally in AsyncStorage
   * - Handles offline/online sync
   */
  async getContinueWatching(): Promise<ContinueWatchingItem[]> {
    try {
      // Get all show progress from progressService (already cached and optimized)
      const allShowsProgress = await progressService.getAllShowsProgress();
      
      // Filter for shows that are in progress (not completed, not dropped)
      const inProgressShows = allShowsProgress.filter(
        sp => sp.status === 'watching' || sp.status === 'up_to_date'
      );

      const items: ContinueWatchingItem[] = [];

      // OPTIMIZATION: Batch fetch next episodes for all shows in one operation
      // This avoids N separate queries to the progress cache
      const showIds = inProgressShows.map(sp => sp.show_id);
      const nextEpisodesMap = await progressService.getNextEpisodesForShows(showIds);

      // Process each show in progress
      for (const showProgress of inProgressShows) {
        try {
          // Get show details from TMDB (cached by tmdbService)
          const showDetails = await tmdbService.getTVShowDetails(showProgress.show_id);
          if (!showDetails) continue;

          // Get next episode from batch result
          const nextEpisodeInfo = nextEpisodesMap.get(showProgress.show_id);
          
          // Only include if there's a next episode to watch (not completed)
          if (nextEpisodeInfo) {
            // Calculate progress percentage
            const totalEpisodes = showDetails.number_of_episodes || 1;
            const watchedEpisodes = showProgress.total_watched_episodes;
            const progress = Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100));

            items.push({
              id: showProgress.show_id,
              type: 'tv',
              title: showDetails.name,
              poster_path: showDetails.poster_path,
              backdrop_path: showDetails.backdrop_path,
              vote_average: showDetails.vote_average,
              progress,
              lastWatchedAt: showProgress.last_watched_date,
              nextEpisode: {
                season: nextEpisodeInfo.season,
                episode: nextEpisodeInfo.episode,
                // Use generic name to avoid additional API calls
                // The UI can fetch full episode details if needed
                name: `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`,
              },
            });
          }
        } catch (error) {
          console.error(`[ContinueWatching] Error processing show ${showProgress.show_id}:`, error);
          // Continue with other shows
        }
      }

      // Sort by most recently watched
      items.sort((a, b) => {
        const dateA = new Date(a.lastWatchedAt).getTime();
        const dateB = new Date(b.lastWatchedAt).getTime();
        return dateB - dateA; // Most recent first
      });

      // NOTE: Movie progress tracking is not currently implemented
      // The app doesn't have a movie_progress table or track partial movie watches
      // When movie progress is added, we can extend this method to include movies

      return items;
    } catch (error) {
      console.error('[ContinueWatching] Error getting continue watching items:', error);
      return [];
    }
  }
}

export const continueWatchingService = new ContinueWatchingService();
