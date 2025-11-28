import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import type { 
  NotificationPayload, 
  NotificationPreferences, 
  WatchlistItem,
  TVShowDetails 
} from '../types';

export interface ShowStatusNotification extends NotificationPayload {
  type: 'recommendation';
  data: {
    recommendationType: 'show_status';
    showId: number;
    showTitle: string;
    statusType: 'renewed' | 'cancelled' | 'ended' | 'returning';
    statusDetails: {
      previousStatus?: string;
      newStatus: string;
      seasonNumber?: number;
      airDate?: string;
      network?: string;
      source: string;
    };
  };
}

export interface ShowStatusUpdate {
  showId: number;
  showTitle: string;
  previousStatus: string;
  newStatus: string;
  statusType: 'renewed' | 'cancelled' | 'ended' | 'returning';
  seasonNumber?: number;
  airDate?: string;
  network?: string;
  source: string;
  detectedAt: string;
}

class ShowStatusNotificationService {
  private readonly STATUS_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly TMDB_STATUS_MAP = {
    'Returning Series': 'returning',
    'Ended': 'ended',
    'Canceled': 'cancelled',
    'In Production': 'renewed',
    'Planned': 'renewed',
    'Pilot': 'pilot'
  };

  /**
   * Process show status updates for user's watchlist
   */
  async processShowStatusUpdates(): Promise<ShowStatusNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('Processing show status updates...');

      // Get user's TV show watchlist
      const watchlist = await storageService.getWatchlist();
      const tvShows = watchlist.filter(item => item.type === 'tv');

      if (tvShows.length === 0) {
        console.log('No TV shows in watchlist');
        return [];
      }

      // Check for status updates
      const statusUpdates: ShowStatusUpdate[] = [];

      for (const show of tvShows) {
        try {
          const update = await this.checkShowStatusUpdate(show);
          if (update) {
            statusUpdates.push(update);
          }
        } catch (error) {
          console.warn(`Failed to check status for ${show.title}:`, error);
        }
      }

      if (statusUpdates.length === 0) {
        console.log('No show status updates found');
        return [];
      }

      // Generate notifications for status updates
      const notifications: ShowStatusNotification[] = [];

      for (const update of statusUpdates) {
        const notification = await this.createShowStatusNotification(user.id, update);
        if (notification) {
          notifications.push(notification);
        }
      }

      console.log(`Generated ${notifications.length} show status notifications`);
      return notifications;

    } catch (error) {
      console.error('Error processing show status updates:', error);
      return [];
    }
  }

  /**
   * Check for status update for a specific show
   */
  private async checkShowStatusUpdate(show: WatchlistItem): Promise<ShowStatusUpdate | null> {
    try {
      // Get current show details from TMDB
      const currentDetails = await tmdbService.getTVShowDetails(show.id);
      
      // Get cached status from our database
      const cachedStatus = await this.getCachedShowStatus(show.id);
      
      // Determine if there's a status change
      const currentStatus = this.normalizeStatus(currentDetails.status);
      const previousStatus = cachedStatus?.status || 'unknown';

      if (currentStatus !== previousStatus && previousStatus !== 'unknown') {
        // Status has changed - create update
        const statusType = this.determineStatusType(previousStatus, currentStatus);
        
        const update: ShowStatusUpdate = {
          showId: show.id,
          showTitle: show.title,
          previousStatus,
          newStatus: currentStatus,
          statusType,
          seasonNumber: this.extractSeasonNumber(currentDetails),
          airDate: currentDetails.last_air_date || currentDetails.first_air_date,
          network: this.extractNetwork(currentDetails),
          source: 'tmdb',
          detectedAt: new Date().toISOString()
        };

        // Update cached status
        await this.updateCachedShowStatus(show.id, currentStatus, currentDetails);

        return update;
      }

      // Update cache even if no status change (for timestamp)
      await this.updateCachedShowStatus(show.id, currentStatus, currentDetails);

      return null;

    } catch (error) {
      console.error(`Error checking status for show ${show.title}:`, error);
      return null;
    }
  }

  /**
   * Get cached show status from database
   */
  private async getCachedShowStatus(showId: number): Promise<{ status: string; lastChecked: string } | null> {
    try {
      const { data, error } = await supabase
        .from('show_status_cache')
        .select('status, last_checked')
        .eq('show_id', showId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data ? { status: data.status, lastChecked: data.last_checked } : null;
    } catch (error) {
      console.error('Error getting cached show status:', error);
      return null;
    }
  }

  /**
   * Update cached show status in database
   */
  private async updateCachedShowStatus(showId: number, status: string, details: TVShowDetails): Promise<void> {
    try {
      const { error } = await supabase
        .from('show_status_cache')
        .upsert({
          show_id: showId,
          status,
          last_checked: new Date().toISOString(),
          tmdb_data: {
            status: details.status,
            number_of_seasons: details.number_of_seasons,
            last_air_date: details.last_air_date,
            next_episode_to_air: details.next_episode_to_air
          }
        }, { onConflict: 'show_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating cached show status:', error);
    }
  }

  /**
   * Create notification for show status update
   */
  private async createShowStatusNotification(
    userId: string, 
    update: ShowStatusUpdate
  ): Promise<ShowStatusNotification | null> {
    try {
      // Check if we've already notified about this status change
      const existingNotification = await this.checkExistingStatusNotification(
        userId, 
        update.showId, 
        update.newStatus
      );

      if (existingNotification) {
        return null;
      }

      // Create notification based on status type
      const { title, body } = this.generateNotificationContent(update);

      const notification: ShowStatusNotification = {
        id: `show_status_${update.showId}_${update.statusType}_${Date.now()}`,
        type: 'recommendation',
        title,
        body,
        data: {
          recommendationType: 'show_status',
          showId: update.showId,
          showTitle: update.showTitle,
          statusType: update.statusType,
          statusDetails: {
            previousStatus: update.previousStatus,
            newStatus: update.newStatus,
            seasonNumber: update.seasonNumber,
            airDate: update.airDate,
            network: update.network,
            source: update.source
          }
        },
        priority: this.getNotificationPriority(update.statusType)
      };

      // Store notification record
      await this.storeStatusNotificationRecord(userId, update);

      return notification;

    } catch (error) {
      console.error('Error creating show status notification:', error);
      return null;
    }
  }

  /**
   * Generate notification content based on status update
   */
  private generateNotificationContent(update: ShowStatusUpdate): { title: string; body: string } {
    switch (update.statusType) {
      case 'renewed':
        return {
          title: `📺 Great News!`,
          body: `${update.showTitle} has been renewed${update.seasonNumber ? ` for season ${update.seasonNumber}` : ''}!`
        };
      
      case 'cancelled':
        return {
          title: `😞 Show Update`,
          body: `${update.showTitle} has been cancelled. Time to find your next binge!`
        };
      
      case 'ended':
        return {
          title: `🎬 Series Finale`,
          body: `${update.showTitle} has ended. Don't miss the final episodes!`
        };
      
      case 'returning':
        return {
          title: `🔄 Show Returning`,
          body: `${update.showTitle} is returning${update.airDate ? ` on ${new Date(update.airDate).toLocaleDateString()}` : ' soon'}!`
        };
      
      default:
        return {
          title: `📺 Show Update`,
          body: `${update.showTitle} status has been updated to ${update.newStatus}`
        };
    }
  }

  /**
   * Get notification priority based on status type
   */
  private getNotificationPriority(statusType: string): 'high' | 'normal' | 'low' {
    switch (statusType) {
      case 'renewed':
        return 'high';
      case 'cancelled':
        return 'high';
      case 'ended':
        return 'normal';
      case 'returning':
        return 'normal';
      default:
        return 'low';
    }
  }

  /**
   * Check if we've already sent a notification for this status change
   */
  private async checkExistingStatusNotification(
    userId: string, 
    showId: number, 
    status: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('show_status_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('show_id', showId)
        .eq('status', status)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking existing status notification:', error);
      return false;
    }
  }

  /**
   * Store notification record to prevent duplicates
   */
  private async storeStatusNotificationRecord(userId: string, update: ShowStatusUpdate): Promise<void> {
    try {
      const { error } = await supabase
        .from('show_status_notifications')
        .insert({
          user_id: userId,
          show_id: update.showId,
          status: update.newStatus,
          status_type: update.statusType,
          notification_data: update,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing status notification record:', error);
    }
  }

  /**
   * Filter notifications based on user preferences
   */
  async filterNotificationsByPreferences(
    notifications: ShowStatusNotification[]
  ): Promise<ShowStatusNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const notificationPrefs = prefs as NotificationPreferences | null;

      if (!notificationPrefs || !notificationPrefs.recommendations) {
        console.log('Show status notifications disabled by user preferences');
        return [];
      }

      // Get show status notification preferences (if they exist)
      const { data: showStatusPrefs } = await supabase
        .from('show_status_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Apply filtering based on preferences
      const filteredNotifications = notifications.filter(notification => {
        const statusType = notification.data.statusType;

        // Check if user wants notifications for this status type
        if (showStatusPrefs) {
          const prefKey = `notify_${statusType}` as keyof typeof showStatusPrefs;
          if (showStatusPrefs[prefKey] === false) {
            return false;
          }
        }

        // Apply quiet hours filtering
        if (notificationPrefs.quietHours.enabled) {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          if (this.isInQuietHours(currentTime, notificationPrefs.quietHours)) {
            // Schedule for after quiet hours
            const scheduledTime = this.calculateScheduleAfterQuietHours(notificationPrefs.quietHours);
            notification.scheduledFor = scheduledTime;
          }
        }

        return true;
      });

      return filteredNotifications;

    } catch (error) {
      console.error('Error filtering show status notifications by preferences:', error);
      return notifications;
    }
  }

  /**
   * Normalize TMDB status to our internal status
   */
  private normalizeStatus(tmdbStatus: string): string {
    return this.TMDB_STATUS_MAP[tmdbStatus as keyof typeof this.TMDB_STATUS_MAP] || tmdbStatus.toLowerCase();
  }

  /**
   * Determine status type based on status change
   */
  private determineStatusType(previousStatus: string, newStatus: string): 'renewed' | 'cancelled' | 'ended' | 'returning' {
    // If moving to cancelled
    if (newStatus === 'cancelled') {
      return 'cancelled';
    }
    
    // If moving to ended
    if (newStatus === 'ended') {
      return 'ended';
    }
    
    // If moving to returning series
    if (newStatus === 'returning') {
      return 'returning';
    }
    
    // If moving to renewed/in production
    if (newStatus === 'renewed' || newStatus === 'in production') {
      return 'renewed';
    }
    
    // Default to returning for other positive changes
    return 'returning';
  }

  /**
   * Extract season number from show details
   */
  private extractSeasonNumber(details: TVShowDetails): number | undefined {
    // Try to get the latest season number
    if (details.seasons && details.seasons.length > 0) {
      const latestSeason = details.seasons
        .filter(season => season.season_number > 0) // Exclude specials (season 0)
        .sort((a, b) => b.season_number - a.season_number)[0];
      
      return latestSeason?.season_number;
    }
    
    return details.number_of_seasons;
  }

  /**
   * Extract network information from show details
   */
  private extractNetwork(details: TVShowDetails): string | undefined {
    // TMDB doesn't always have network info in the basic details
    // This would need to be enhanced with additional API calls if needed
    return undefined;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(currentTime: string, quietHours: { start: string; end: string }): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(quietHours.start);
    const end = this.timeToMinutes(quietHours.end);

    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Quiet hours span midnight
      return current >= start || current <= end;
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calculate schedule time after quiet hours
   */
  private calculateScheduleAfterQuietHours(quietHours: { start: string; end: string }): string {
    const now = new Date();
    const endTime = quietHours.end;
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const scheduleDate = new Date(now);
    scheduleDate.setHours(endHours, endMinutes, 0, 0);

    // If end time is earlier in the day, it means quiet hours span midnight
    if (endHours < now.getHours()) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    return scheduleDate.toISOString();
  }

  /**
   * Get default show status preferences
   */
  async getDefaultShowStatusPreferences(userId: string) {
    return {
      user_id: userId,
      notify_renewed: true,
      notify_cancelled: true,
      notify_ended: true,
      notify_returning: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Update show status preferences
   */
  async updateShowStatusPreferences(userId: string, preferences: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('show_status_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating show status preferences:', error);
      throw error;
    }
  }
}

export const showStatusNotificationService = new ShowStatusNotificationService();