import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import { episodeNotificationService } from './episodeNotifications';
import { Episode, TVShowDetails, WatchlistItem } from '../types';

interface NewEpisode {
  showId: number;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string;
  overview: string;
  stillPath: string | null;
}

interface EpisodeCache {
  showId: number;
  lastChecked: string;
  latestEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    airDate: string;
  };
  episodes: Episode[];
}

export class EpisodeTracker {
  private readonly CACHE_KEY = 'episode_tracker_cache';
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check for new episodes for all shows in user's watchlist
   */
  async checkForNewEpisodes(): Promise<NewEpisode[]> {
    try {
      console.log('[EpisodeTracker] Starting new episode check');
      
      // Get user's watchlist TV shows
      const watchlist = await storageService.getWatchlist();
      const tvShows = watchlist.filter(item => item.type === 'tv');
      
      if (tvShows.length === 0) {
        console.log('[EpisodeTracker] No TV shows in watchlist');
        return [];
      }

      console.log(`[EpisodeTracker] Checking ${tvShows.length} TV shows for new episodes`);
      
      const newEpisodes: NewEpisode[] = [];
      const cache = await this.getEpisodeCache();
      
      for (const show of tvShows) {
        try {
          const showNewEpisodes = await this.checkShowForNewEpisodes(show, cache);
          newEpisodes.push(...showNewEpisodes);
        } catch (error) {
          console.error(`[EpisodeTracker] Error checking show ${show.id}:`, error);
        }
      }

      // Update cache with new data
      await this.saveEpisodeCache(cache);
      
      console.log(`[EpisodeTracker] Found ${newEpisodes.length} new episodes`);
      
      // Generate notifications for new episodes
      if (newEpisodes.length > 0) {
        try {
          await episodeNotificationService.generateEpisodeNotifications(newEpisodes);
          console.log(`[EpisodeTracker] Generated notifications for ${newEpisodes.length} new episodes`);
        } catch (error) {
          console.error('[EpisodeTracker] Error generating episode notifications:', error);
          // Don't fail the episode check if notifications fail
        }
      }
      
      return newEpisodes;
      
    } catch (error) {
      console.error('[EpisodeTracker] Error checking for new episodes:', error);
      return [];
    }
  }

  /**
   * Check a specific show for new episodes
   */
  private async checkShowForNewEpisodes(
    watchlistItem: WatchlistItem, 
    cache: Map<number, EpisodeCache>
  ): Promise<NewEpisode[]> {
    const showId = watchlistItem.id;
    const cachedData = cache.get(showId);
    const now = new Date().toISOString();
    
    // Check if we need to fetch fresh data
    const shouldFetch = !cachedData || 
      (Date.now() - new Date(cachedData.lastChecked).getTime()) > this.CACHE_DURATION;
    
    if (!shouldFetch) {
      console.log(`[EpisodeTracker] Using cached data for show ${showId}`);
      return [];
    }

    try {
      // Get show details from TMDB
      const showDetails = await tmdbService.getTVShowDetails(showId);
      if (!showDetails) {
        console.warn(`[EpisodeTracker] Could not fetch details for show ${showId}`);
        return [];
      }

      // Find the latest aired episode
      const latestAiredEpisode = await this.findLatestAiredEpisode(showDetails);
      if (!latestAiredEpisode) {
        console.log(`[EpisodeTracker] No aired episodes found for show ${showId}`);
        return [];
      }

      const newEpisodes: NewEpisode[] = [];
      
      // Compare with cached data to find new episodes
      if (cachedData) {
        const cachedLatest = cachedData.latestEpisode;
        
        // Check if there's a newer episode
        if (this.isEpisodeNewer(latestAiredEpisode, cachedLatest)) {
          // Get all episodes between cached and latest
          const episodesBetween = await this.getEpisodesBetween(
            showDetails,
            cachedLatest,
            latestAiredEpisode
          );
          
          for (const episode of episodesBetween) {
            newEpisodes.push({
              showId,
              showName: showDetails.name,
              seasonNumber: episode.season_number,
              episodeNumber: episode.episode_number,
              episodeName: episode.name,
              airDate: episode.air_date,
              overview: episode.overview,
              stillPath: episode.still_path,
            });
          }
        }
      } else {
        // First time checking this show - don't notify about existing episodes
        console.log(`[EpisodeTracker] First time checking show ${showId}, not notifying about existing episodes`);
      }

      // Update cache
      cache.set(showId, {
        showId,
        lastChecked: now,
        latestEpisode: {
          seasonNumber: latestAiredEpisode.season_number,
          episodeNumber: latestAiredEpisode.episode_number,
          airDate: latestAiredEpisode.air_date,
        },
        episodes: [], // We don't need to cache all episodes, just the latest info
      });

      return newEpisodes;
      
    } catch (error) {
      console.error(`[EpisodeTracker] Error checking show ${showId}:`, error);
      return [];
    }
  }

  /**
   * Find the latest aired episode for a show
   */
  private async findLatestAiredEpisode(showDetails: TVShowDetails): Promise<Episode | null> {
    const today = new Date();
    let latestEpisode: Episode | null = null;

    // Check seasons in reverse order (latest first)
    const sortedSeasons = showDetails.seasons
      .filter(season => season.season_number > 0) // Skip specials
      .sort((a, b) => b.season_number - a.season_number);

    for (const season of sortedSeasons) {
      try {
        const seasonDetails = await tmdbService.getSeasonDetails(showDetails.id, season.season_number);
        if (!seasonDetails.episodes) continue;

        // Find the latest aired episode in this season
        const airedEpisodes = seasonDetails.episodes.filter(episode => {
          if (!episode.air_date) return false;
          const airDate = new Date(episode.air_date);
          return airDate <= today;
        });

        if (airedEpisodes.length > 0) {
          // Get the episode with the highest episode number
          const seasonLatest = airedEpisodes.reduce((prev, current) => 
            current.episode_number > prev.episode_number ? current : prev
          );

          // If this is the first episode we found, or it's newer than our current latest
          if (!latestEpisode || this.isEpisodeNewer(seasonLatest, latestEpisode)) {
            latestEpisode = seasonLatest;
          }
        }
      } catch (error) {
        console.error(`[EpisodeTracker] Error fetching season ${season.season_number}:`, error);
      }
    }

    return latestEpisode;
  }

  /**
   * Check if episode A is newer than episode B
   */
  private isEpisodeNewer(episodeA: Episode, episodeB: Episode | { seasonNumber: number; episodeNumber: number }): boolean {
    const seasonA = episodeA.season_number;
    const episodeNumA = episodeA.episode_number;
    const seasonB = 'season_number' in episodeB ? episodeB.season_number : episodeB.seasonNumber;
    const episodeNumB = 'episode_number' in episodeB ? episodeB.episode_number : episodeB.episodeNumber;

    if (seasonA > seasonB) return true;
    if (seasonA < seasonB) return false;
    return episodeNumA > episodeNumB;
  }

  /**
   * Get all episodes between two episodes (exclusive of start, inclusive of end)
   */
  private async getEpisodesBetween(
    showDetails: TVShowDetails,
    startEpisode: { seasonNumber: number; episodeNumber: number },
    endEpisode: Episode
  ): Promise<Episode[]> {
    const episodes: Episode[] = [];
    const today = new Date();

    // If they're in the same season
    if (startEpisode.seasonNumber === endEpisode.season_number) {
      try {
        const seasonDetails = await tmdbService.getSeasonDetails(showDetails.id, startEpisode.seasonNumber);
        if (seasonDetails.episodes) {
          const newEpisodes = seasonDetails.episodes.filter(ep => {
            const isNewer = ep.episode_number > startEpisode.episodeNumber && 
                           ep.episode_number <= endEpisode.episode_number;
            const hasAired = ep.air_date && new Date(ep.air_date) <= today;
            return isNewer && hasAired;
          });
          episodes.push(...newEpisodes);
        }
      } catch (error) {
        console.error(`[EpisodeTracker] Error fetching season ${startEpisode.seasonNumber}:`, error);
      }
    } else {
      // Handle episodes across multiple seasons
      for (let seasonNum = startEpisode.seasonNumber; seasonNum <= endEpisode.season_number; seasonNum++) {
        try {
          const seasonDetails = await tmdbService.getSeasonDetails(showDetails.id, seasonNum);
          if (!seasonDetails.episodes) continue;

          const seasonEpisodes = seasonDetails.episodes.filter(ep => {
            const hasAired = ep.air_date && new Date(ep.air_date) <= today;
            if (!hasAired) return false;

            if (seasonNum === startEpisode.seasonNumber) {
              // First season: episodes after the start episode
              return ep.episode_number > startEpisode.episodeNumber;
            } else if (seasonNum === endEpisode.season_number) {
              // Last season: episodes up to and including the end episode
              return ep.episode_number <= endEpisode.episode_number;
            } else {
              // Middle seasons: all episodes
              return true;
            }
          });

          episodes.push(...seasonEpisodes);
        } catch (error) {
          console.error(`[EpisodeTracker] Error fetching season ${seasonNum}:`, error);
        }
      }
    }

    return episodes;
  }

  /**
   * Get upcoming episodes (aired within the last 7 days or airing in the next 7 days)
   */
  async getUpcomingEpisodes(): Promise<NewEpisode[]> {
    try {
      const watchlist = await storageService.getWatchlist();
      const tvShows = watchlist.filter(item => item.type === 'tv');
      const upcomingEpisodes: NewEpisode[] = [];
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const show of tvShows) {
        try {
          const showDetails = await tmdbService.getTVShowDetails(show.id);
          if (!showDetails) continue;

          // Check the latest seasons for upcoming episodes
          const recentSeasons = showDetails.seasons
            .filter(s => s.season_number > 0)
            .sort((a, b) => b.season_number - a.season_number)
            .slice(0, 2); // Check last 2 seasons

          for (const season of recentSeasons) {
            const seasonDetails = await tmdbService.getSeasonDetails(show.id, season.season_number);
            if (!seasonDetails.episodes) continue;

            const relevantEpisodes = seasonDetails.episodes.filter(episode => {
              if (!episode.air_date) return false;
              const airDate = new Date(episode.air_date);
              return airDate >= sevenDaysAgo && airDate <= sevenDaysFromNow;
            });

            for (const episode of relevantEpisodes) {
              upcomingEpisodes.push({
                showId: show.id,
                showName: showDetails.name,
                seasonNumber: episode.season_number,
                episodeNumber: episode.episode_number,
                episodeName: episode.name,
                airDate: episode.air_date,
                overview: episode.overview,
                stillPath: episode.still_path,
              });
            }
          }
        } catch (error) {
          console.error(`[EpisodeTracker] Error getting upcoming episodes for show ${show.id}:`, error);
        }
      }

      return upcomingEpisodes.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());
    } catch (error) {
      console.error('[EpisodeTracker] Error getting upcoming episodes:', error);
      return [];
    }
  }

  /**
   * Get episode cache from local storage
   */
  private async getEpisodeCache(): Promise<Map<number, EpisodeCache>> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return new Map();

      const cacheArray: EpisodeCache[] = JSON.parse(cacheData);
      const cacheMap = new Map<number, EpisodeCache>();
      
      cacheArray.forEach(item => {
        cacheMap.set(item.showId, item);
      });

      return cacheMap;
    } catch (error) {
      console.error('[EpisodeTracker] Error loading episode cache:', error);
      return new Map();
    }
  }

  /**
   * Save episode cache to local storage
   */
  private async saveEpisodeCache(cache: Map<number, EpisodeCache>): Promise<void> {
    try {
      const cacheArray = Array.from(cache.values());
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheArray));
    } catch (error) {
      console.error('[EpisodeTracker] Error saving episode cache:', error);
    }
  }

  /**
   * Clear episode cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log('[EpisodeTracker] Cache cleared');
    } catch (error) {
      console.error('[EpisodeTracker] Error clearing cache:', error);
    }
  }

  /**
   * Get cache status for debugging
   */
  async getCacheStatus(): Promise<{ totalShows: number; lastUpdated: string | null }> {
    try {
      const cache = await this.getEpisodeCache();
      const cacheArray = Array.from(cache.values());
      
      const lastUpdated = cacheArray.length > 0 
        ? cacheArray.reduce((latest, item) => 
            new Date(item.lastChecked) > new Date(latest) ? item.lastChecked : latest
          , cacheArray[0].lastChecked)
        : null;

      return {
        totalShows: cacheArray.length,
        lastUpdated,
      };
    } catch (error) {
      console.error('[EpisodeTracker] Error getting cache status:', error);
      return { totalShows: 0, lastUpdated: null };
    }
  }
}

// Export singleton instance
export const episodeTracker = new EpisodeTracker();