import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export interface NotificationPayload {
  type: 'episode_release' | 'streaming_availability' | 'recommendation' | 'progress_sync' | 'show_status';
  showId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  movieId?: number;
  contentType?: 'movie' | 'tv';
  action?: string;
  url?: string;
}

/**
 * NotificationDeepLinkingService
 * 
 * Handles navigation from notification taps to relevant screens.
 * Supports deep linking for episodes, shows, movies, and other content.
 */
export class NotificationDeepLinkingService {
  private static instance: NotificationDeepLinkingService;

  static getInstance(): NotificationDeepLinkingService {
    if (!NotificationDeepLinkingService.instance) {
      NotificationDeepLinkingService.instance = new NotificationDeepLinkingService();
    }
    return NotificationDeepLinkingService.instance;
  }

  /**
   * Initialize notification handling
   */
  initialize(): void {
    // Handle notification taps when app is running
    Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);

    // Handle deep links when app is opened from notification
    Linking.addEventListener('url', this.handleDeepLink);
  }

  /**
   * Handle notification tap response
   */
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    const data = response.notification.request.content.data;
    if (data && typeof data === 'object' && 'type' in data) {
      const payload = data as unknown as NotificationPayload;
      this.navigateFromPayload(payload);
    }
  };

  /**
   * Handle deep link URL
   */
  private handleDeepLink = (event: { url: string }): void => {
    this.parseAndNavigate(event.url);
  };

  /**
   * Parse deep link URL and navigate
   */
  parseAndNavigate(url: string): void {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;

      // Handle different deep link patterns
      if (path.startsWith('/episode/')) {
        const pathParts = path.split('/');
        const showId = parseInt(pathParts[2]);
        const seasonNumber = parseInt(pathParts[3]);
        const episodeNumber = parseInt(pathParts[4]);

        if (showId && seasonNumber && episodeNumber) {
          this.navigateToEpisode(showId, seasonNumber, episodeNumber);
        }
      } else if (path.startsWith('/details/')) {
        const pathParts = path.split('/');
        const type = pathParts[2] as 'movie' | 'tv';
        const id = parseInt(pathParts[3]);

        if (type && id) {
          this.navigateToDetails(type, id);
        }
      } else if (path === '/watchlist') {
        this.navigateToWatchlist();
      } else if (path === '/recommendations') {
        this.navigateToRecommendations();
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  }

  /**
   * Navigate based on notification payload
   */
  navigateFromPayload(payload: NotificationPayload): void {
    try {
      switch (payload.type) {
        case 'episode_release':
          if (payload.showId && payload.seasonNumber && payload.episodeNumber) {
            this.navigateToEpisode(payload.showId, payload.seasonNumber, payload.episodeNumber);
          } else if (payload.showId) {
            this.navigateToDetails('tv', payload.showId);
          }
          break;

        case 'streaming_availability':
          if (payload.contentType && payload.showId) {
            this.navigateToDetails(payload.contentType, payload.showId);
          } else if (payload.movieId) {
            this.navigateToDetails('movie', payload.movieId);
          }
          break;

        case 'recommendation':
          if (payload.contentType && payload.showId) {
            this.navigateToDetails(payload.contentType, payload.showId);
          } else if (payload.movieId) {
            this.navigateToDetails('movie', payload.movieId);
          } else {
            this.navigateToRecommendations();
          }
          break;

        case 'show_status':
          if (payload.showId) {
            this.navigateToDetails('tv', payload.showId);
          }
          break;

        case 'progress_sync':
          this.navigateToWatchlist();
          break;

        default:
          // Default to home screen
          this.navigateToHome();
          break;
      }
    } catch (error) {
      console.error('Error navigating from notification payload:', error);
      this.navigateToHome();
    }
  }

  /**
   * Navigate to episode details
   */
  private navigateToEpisode(showId: number, seasonNumber: number, episodeNumber: number): void {
    router.push(`/episode/${showId}/${seasonNumber}/${episodeNumber}`);
  }

  /**
   * Navigate to content details (movie or TV show)
   */
  private navigateToDetails(type: 'movie' | 'tv', id: number): void {
    router.push(`/details/${type}/${id}`);
  }

  /**
   * Navigate to watchlist
   */
  private navigateToWatchlist(): void {
    router.push('/(tabs)/watchlist');
  }

  /**
   * Navigate to recommendations
   */
  private navigateToRecommendations(): void {
    router.push('/recommendations');
  }

  /**
   * Navigate to home screen
   */
  private navigateToHome(): void {
    router.push('/(tabs)');
  }

  /**
   * Generate deep link URL for notification
   */
  generateDeepLink(payload: NotificationPayload): string {
    const baseUrl = 'streamscribe://';

    switch (payload.type) {
      case 'episode_release':
        if (payload.showId && payload.seasonNumber && payload.episodeNumber) {
          return `${baseUrl}episode/${payload.showId}/${payload.seasonNumber}/${payload.episodeNumber}`;
        } else if (payload.showId) {
          return `${baseUrl}details/tv/${payload.showId}`;
        }
        return baseUrl;

      case 'streaming_availability':
        if (payload.contentType && payload.showId) {
          return `${baseUrl}details/${payload.contentType}/${payload.showId}`;
        } else if (payload.movieId) {
          return `${baseUrl}details/movie/${payload.movieId}`;
        }
        return baseUrl;

      case 'recommendation':
        if (payload.contentType && payload.showId) {
          return `${baseUrl}details/${payload.contentType}/${payload.showId}`;
        } else if (payload.movieId) {
          return `${baseUrl}details/movie/${payload.movieId}`;
        } else {
          return `${baseUrl}recommendations`;
        }

      case 'show_status':
        if (payload.showId) {
          return `${baseUrl}details/tv/${payload.showId}`;
        }
        return baseUrl;

      case 'progress_sync':
        return `${baseUrl}watchlist`;

      default:
        return baseUrl;
    }

    return baseUrl;
  }

  /**
   * Create notification action buttons
   */
  createNotificationActions(payload: NotificationPayload): Notifications.NotificationAction[] {
    const actions: Notifications.NotificationAction[] = [];

    switch (payload.type) {
      case 'episode_release':
        actions.push({
          identifier: 'view_episode',
          buttonTitle: 'Watch Now',
          options: {
            opensAppToForeground: true,
          },
        });
        actions.push({
          identifier: 'mark_watched',
          buttonTitle: 'Mark Watched',
          options: {
            opensAppToForeground: false,
          },
        });
        break;

      case 'streaming_availability':
        actions.push({
          identifier: 'view_content',
          buttonTitle: 'View Details',
          options: {
            opensAppToForeground: true,
          },
        });
        actions.push({
          identifier: 'add_to_watchlist',
          buttonTitle: 'Add to Watchlist',
          options: {
            opensAppToForeground: false,
          },
        });
        break;

      case 'recommendation':
        actions.push({
          identifier: 'view_recommendation',
          buttonTitle: 'View',
          options: {
            opensAppToForeground: true,
          },
        });
        actions.push({
          identifier: 'dismiss_recommendation',
          buttonTitle: 'Not Interested',
          options: {
            opensAppToForeground: false,
          },
        });
        break;

      case 'show_status':
        actions.push({
          identifier: 'view_show',
          buttonTitle: 'View Show',
          options: {
            opensAppToForeground: true,
          },
        });
        break;

      default:
        actions.push({
          identifier: 'open_app',
          buttonTitle: 'Open App',
          options: {
            opensAppToForeground: true,
          },
        });
        break;
    }

    return actions;
  }

  /**
   * Handle notification action responses
   */
  handleNotificationAction(actionIdentifier: string, payload: NotificationPayload): void {
    switch (actionIdentifier) {
      case 'view_episode':
      case 'view_content':
      case 'view_recommendation':
      case 'view_show':
      case 'open_app':
        this.navigateFromPayload(payload);
        break;

      case 'mark_watched':
        this.handleMarkWatchedAction(payload);
        break;

      case 'add_to_watchlist':
        this.handleAddToWatchlistAction(payload);
        break;

      case 'dismiss_recommendation':
        this.handleDismissRecommendationAction(payload);
        break;

      default:
        console.log('Unknown notification action:', actionIdentifier);
        break;
    }
  }

  /**
   * Handle mark watched action
   */
  private async handleMarkWatchedAction(payload: NotificationPayload): Promise<void> {
    try {
      if (payload.showId && payload.seasonNumber && payload.episodeNumber) {
        const { progressService } = await import('./progress');
        await progressService.markEpisodeWatched(
          payload.showId,
          payload.seasonNumber,
          payload.episodeNumber
        );
      }
    } catch (error) {
      console.error('Error marking episode as watched:', error);
    }
  }

  /**
   * Handle add to watchlist action
   */
  private async handleAddToWatchlistAction(payload: NotificationPayload): Promise<void> {
    try {
      if (payload.contentType && (payload.showId || payload.movieId)) {
        const { storageService } = await import('./storage');
        const { tmdbService } = await import('./tmdb');

        const id = payload.showId || payload.movieId!;
        const content = payload.contentType === 'movie' 
          ? await tmdbService.getMovieDetails(id)
          : await tmdbService.getTVShowDetails(id);

        if (content) {
          const watchlistItem = {
            id: content.id,
            type: payload.contentType,
            title: 'title' in content ? content.title : content.name,
            poster_path: content.poster_path,
            vote_average: content.vote_average,
            release_date: 'release_date' in content ? content.release_date : content.first_air_date,
            added_date: new Date().toISOString(),
            watched: false,
          };

          await storageService.addToWatchlist(watchlistItem);
        }
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }

  /**
   * Handle dismiss recommendation action
   */
  private async handleDismissRecommendationAction(payload: NotificationPayload): Promise<void> {
    try {
      // This would integrate with a recommendation service to mark as dismissed
      console.log('Dismissing recommendation:', payload);
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
    }
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    Linking.removeAllListeners('url');
  }
}

// Singleton instance
export const notificationDeepLinkingService = NotificationDeepLinkingService.getInstance();