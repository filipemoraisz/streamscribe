import { RecommendationItem } from '../types';
import { progressService } from './progress';
import { storageService } from './storage';

/**
 * SwipeActionService
 * 
 * Handles swipe actions for the Start Watching Widget:
 * - Right swipe: Mark as watched
 * - Left swipe: Dismiss recommendation
 * - Up swipe: Remove from watchlist
 * 
 * Includes error handling with exponential backoff retry logic.
 */
class SwipeActionService {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000; // 1 second

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt + 1} failed:`, error);

        if (attempt < retries - 1) {
          // Calculate exponential backoff delay: 1s, 2s, 4s
          const delay = this.BASE_DELAY * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Log action for analytics
   */
  private async logAction(
    userId: string,
    contentId: number,
    contentType: 'movie' | 'tv',
    action: 'watched' | 'dismissed' | 'removed'
  ): Promise<void> {
    try {
      console.log(`[SwipeAction] ${action} - ${contentType} ${contentId} by user ${userId}`);
      
      // Track activity for analytics
      // This could be expanded to insert into a dedicated analytics table
      if (action === 'watched') {
        // Activity tracking is handled by progressService and storageService
        console.log(`[SwipeAction] Activity tracking handled by progress/storage service`);
      }
    } catch (error) {
      console.error('[SwipeAction] Error logging action:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Mark item as watched (swipe right)
   * 
   * For TV shows: Marks episode 1 season 1 as watched
   * For movies: Marks the movie as watched
   * 
   * @param item - The recommendation item to mark as watched
   * @param userId - The user ID
   * @throws Error if the operation fails after retries
   */
  async markAsWatched(
    item: RecommendationItem,
    userId: string
  ): Promise<void> {
    console.log(`[SwipeAction] markAsWatched called for ${item.type} ${item.id}`);

    try {
      await this.retryWithBackoff(async () => {
        if (item.type === 'tv') {
          // Mark episode 1 season 1 as watched for TV shows
          await progressService.markEpisodeWatched(item.id, 1, 1);
          console.log(`[SwipeAction] ✅ Marked S01E01 of show ${item.id} as watched`);
          
          // Update watchlist status to 'watching' so it won't appear in widget again
          await storageService.updateWatchlistStatus(item.id, 'tv', 'watching');
          console.log(`[SwipeAction] ✅ Updated watchlist status to 'watching'`);
        } else {
          // Mark movie as watched
          await storageService.markAsWatched({
            id: item.id,
            type: 'movie',
            title: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date,
            vote_average: item.vote_average,
            watched: true,
            rewatch_count: 0
          });
          console.log(`[SwipeAction] ✅ Marked movie ${item.id} as watched`);
        }
      });

      // Log action for analytics
      await this.logAction(userId, item.id, item.type, 'watched');

    } catch (error) {
      console.error(`[SwipeAction] Failed to mark ${item.type} ${item.id} as watched:`, error);
      throw new Error(`Failed to mark as watched: ${(error as Error).message}`);
    }
  }

  /**
   * Dismiss recommendation (swipe left)
   * 
   * Tracks dismissed item ID in local state.
   * No backend persistence needed - item stays in watchlist but won't show in widget.
   * 
   * @param item - The recommendation item to dismiss
   * @param userId - The user ID
   * @returns The dismissed item ID
   */
  async dismissRecommendation(
    item: RecommendationItem,
    userId: string
  ): Promise<string> {
    console.log(`[SwipeAction] dismissRecommendation called for ${item.type} ${item.id}`);

    try {
      // Generate dismissed ID (type-id format for uniqueness)
      const dismissedId = `${item.type}-${item.id}`;

      // Log action for analytics
      await this.logAction(userId, item.id, item.type, 'dismissed');

      console.log(`[SwipeAction] ✅ Dismissed ${item.type} ${item.id}`);
      return dismissedId;

    } catch (error) {
      console.error(`[SwipeAction] Failed to dismiss ${item.type} ${item.id}:`, error);
      throw new Error(`Failed to dismiss: ${(error as Error).message}`);
    }
  }

  /**
   * Remove from watchlist (swipe up)
   * 
   * For movies: Removes from watchlist
   * For TV shows: Returns 'show-alert' to trigger UI alert
   * 
   * @param item - The recommendation item to remove
   * @param userId - The user ID
   * @param action - For TV shows: 'remove' or 'mark-all-watched'
   * @returns 'show-alert' for TV shows, void for movies
   * @throws Error if the operation fails after retries
   */
  async removeFromWatchlist(
    item: RecommendationItem,
    userId: string,
    action?: 'remove' | 'mark-all-watched'
  ): Promise<'show-alert' | void> {
    console.log(`[SwipeAction] removeFromWatchlist called for ${item.type} ${item.id}, action: ${action}`);

    // For TV shows without an action specified, return signal to show alert
    if (item.type === 'tv' && !action) {
      console.log(`[SwipeAction] TV show detected - returning show-alert signal`);
      return 'show-alert';
    }

    try {
      await this.retryWithBackoff(async () => {
        if (item.type === 'tv' && action === 'mark-all-watched') {
          // Mark all episodes as watched (update watchlist status to completed)
          await storageService.markAsWatched({
            id: item.id,
            type: 'tv',
            title: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date,
            vote_average: item.vote_average,
            watched: true,
            rewatch_count: 0
          });
          console.log(`[SwipeAction] ✅ Marked all episodes of show ${item.id} as watched`);
        } else {
          // Remove from watchlist (movies or TV shows with 'remove' action)
          await storageService.removeFromWatchlist(item.id, item.type);
          console.log(`[SwipeAction] ✅ Removed ${item.type} ${item.id} from watchlist`);
        }
      });

      // Log action for analytics
      await this.logAction(userId, item.id, item.type, 'removed');

      // Note: Watchlist update event is automatically triggered by storageService
      // through its queue system and sync mechanism

    } catch (error) {
      console.error(`[SwipeAction] Failed to remove ${item.type} ${item.id} from watchlist:`, error);
      throw new Error(`Failed to remove from watchlist: ${(error as Error).message}`);
    }
  }

  /**
   * Rollback mechanism for failed actions
   * 
   * This method can be called by the UI to handle rollback when an action fails.
   * The UI should keep track of the previous state and pass the appropriate rollback function.
   * 
   * @param rollbackFn - Function to execute for rollback
   * @param errorMessage - User-friendly error message to display
   */
  async handleRollback(
    rollbackFn: () => void | Promise<void>,
    errorMessage: string
  ): Promise<void> {
    try {
      console.log(`[SwipeAction] Executing rollback: ${errorMessage}`);
      await rollbackFn();
      console.log(`[SwipeAction] ✅ Rollback completed`);
    } catch (rollbackError) {
      console.error('[SwipeAction] Rollback failed:', rollbackError);
      // Even if rollback fails, we've already logged it
      // The UI should handle showing the error to the user
    }
  }
}

export const swipeActionService = new SwipeActionService();
