import { supabase } from './supabase';
import { notificationManager } from './notifications';
import { notificationSyncService } from './notificationSync';
import { notificationHistoryService } from './notificationHistory';
import type { NotificationPreferences, LocalNotification } from '../types';

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

interface EpisodeNotificationGroup {
  showId: number;
  showName: string;
  episodes: NewEpisode[];
  userId: string;
}

interface NotificationTemplate {
  title: string;
  body: string;
  data: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  category?: string;
  actions?: NotificationAction[];
  badge?: number;
  sound?: string;
  image?: string;
}

interface NotificationAction {
  id: string;
  title: string;
  type: 'foreground' | 'background';
}

interface EpisodeNotificationContext {
  isSeasonFinale: boolean;
  isSeriesFinale: boolean;
  isSeasonPremiere: boolean;
  isSeriesPremiere: boolean;
  daysSinceLastEpisode?: number;
  totalEpisodesInSeason?: number;
}

export class EpisodeNotificationService {
  
  /**
   * Generate and send notifications for new episodes
   */
  async generateEpisodeNotifications(newEpisodes: NewEpisode[]): Promise<void> {
    try {
      console.log(`[EpisodeNotifications] Generating notifications for ${newEpisodes.length} new episodes`);
      
      if (newEpisodes.length === 0) {
        return;
      }

      // Get users who have these shows in their watchlist
      const showIds = Array.from(new Set(newEpisodes.map(ep => ep.showId)));
      const usersWithShows = await this.getUsersWithShows(showIds);
      
      if (usersWithShows.length === 0) {
        console.log('[EpisodeNotifications] No users found with these shows in watchlist');
        return;
      }

      // Get notification preferences for all users
      const userIds = Array.from(new Set(usersWithShows.map(u => u.user_id)));
      const userPreferences = await this.getUserNotificationPreferences(userIds);
      
      // Group episodes by user and show
      const notificationGroups = this.groupEpisodesByUserAndShow(newEpisodes, usersWithShows);
      
      // Generate and send notifications with enhanced filtering
      let notificationsSent = 0;
      
      for (const group of notificationGroups) {
        const userPrefs = userPreferences.get(group.userId);
        
        // Apply enhanced user preference filtering
        if (!(await this.shouldNotifyUser(userPrefs, group.userId, group.showId, group.episodes))) {
          console.log(`[EpisodeNotifications] Skipping notifications for user ${group.userId} - disabled in preferences or show status`);
          continue;
        }

        // Filter episodes based on user's watch progress and preferences
        const filteredEpisodes = await this.filterEpisodesByPreferences(
          group.episodes, 
          group.userId, 
          userPrefs || this.getDefaultPreferences(group.userId)
        );

        if (filteredEpisodes.length === 0) {
          console.log(`[EpisodeNotifications] No unwatched episodes for user ${group.userId}, show ${group.showId}`);
          continue;
        }

        // Update group with filtered episodes
        const filteredGroup: EpisodeNotificationGroup = {
          ...group,
          episodes: filteredEpisodes,
        };

        // Get episode context for better notification templates
        const context = await this.getEpisodeContext(filteredGroup);

        // Generate notification template with context
        const template = await this.createNotificationTemplate(filteredGroup, context);
        
        // Calculate when to send the notification (considering quiet hours)
        const scheduledFor = this.calculateScheduleTime(userPrefs);
        
        // Send notification
        await this.sendNotification(group.userId, template, scheduledFor);
        notificationsSent++;
        
        console.log(`[EpisodeNotifications] Sent notification to user ${group.userId} for ${filteredEpisodes.length} episodes of ${group.showName}`);
      }
      
      console.log(`[EpisodeNotifications] Sent ${notificationsSent} episode notifications`);
      
    } catch (error) {
      console.error('[EpisodeNotifications] Error generating episode notifications:', error);
      throw error;
    }
  }

  /**
   * Get users who have specific shows in their watchlist
   */
  private async getUsersWithShows(showIds: number[]): Promise<Array<{ user_id: string; tmdb_id: number }>> {
    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select('user_id, tmdb_id')
        .eq('media_type', 'tv')
        .in('tmdb_id', showIds);

      if (error) {
        throw new Error(`Failed to fetch users with shows: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('[EpisodeNotifications] Error fetching users with shows:', error);
      return [];
    }
  }

  /**
   * Get notification preferences for users
   */
  private async getUserNotificationPreferences(userIds: string[]): Promise<Map<string, NotificationPreferences>> {
    const preferencesMap = new Map<string, NotificationPreferences>();
    
    try {
      // Try to get from sync service first (includes local cache)
      for (const userId of userIds) {
        try {
          const prefs = await notificationSyncService.getPreferences();
          if (prefs && prefs.userId === userId) {
            preferencesMap.set(userId, prefs);
          }
        } catch (error) {
          console.warn(`[EpisodeNotifications] Could not get preferences for user ${userId} from sync service`);
        }
      }

      // For users we don't have preferences for, fetch from database
      const missingUserIds = userIds.filter(id => !preferencesMap.has(id));
      
      if (missingUserIds.length > 0) {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .in('user_id', missingUserIds);

        if (!error && data) {
          data.forEach(pref => {
            preferencesMap.set(pref.user_id, {
              userId: pref.user_id,
              episodeReleases: pref.episode_releases,
              streamingUpdates: pref.streaming_updates,
              recommendations: pref.recommendations,
              progressSync: pref.progress_sync,
              quietHours: pref.quiet_hours || {
                enabled: false,
                start: '22:00',
                end: '08:00',
              },
              frequency: pref.frequency,
              updatedAt: pref.updated_at,
            });
          });
        }
      }

      // For users still missing preferences, use defaults
      const stillMissingUserIds = userIds.filter(id => !preferencesMap.has(id));
      stillMissingUserIds.forEach(userId => {
        preferencesMap.set(userId, this.getDefaultPreferences(userId));
      });

      return preferencesMap;
    } catch (error) {
      console.error('[EpisodeNotifications] Error fetching notification preferences:', error);
      
      // Return default preferences for all users
      userIds.forEach(userId => {
        preferencesMap.set(userId, this.getDefaultPreferences(userId));
      });
      
      return preferencesMap;
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      episodeReleases: true,
      streamingUpdates: true,
      recommendations: true,
      progressSync: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
      frequency: 'immediate',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Group episodes by user and show for notification generation with intelligent grouping
   */
  private groupEpisodesByUserAndShow(
    episodes: NewEpisode[], 
    usersWithShows: Array<{ user_id: string; tmdb_id: number }>
  ): EpisodeNotificationGroup[] {
    const groups: EpisodeNotificationGroup[] = [];
    
    // Create a map of show -> users for efficient lookup
    const showToUsers = new Map<number, string[]>();
    usersWithShows.forEach(item => {
      if (!showToUsers.has(item.tmdb_id)) {
        showToUsers.set(item.tmdb_id, []);
      }
      showToUsers.get(item.tmdb_id)!.push(item.user_id);
    });

    // Group episodes by show first
    const episodesByShow = new Map<number, NewEpisode[]>();
    episodes.forEach(episode => {
      if (!episodesByShow.has(episode.showId)) {
        episodesByShow.set(episode.showId, []);
      }
      episodesByShow.get(episode.showId)!.push(episode);
    });

    // Create notification groups for each user-show combination with intelligent grouping
    for (const [showId, showEpisodes] of Array.from(episodesByShow.entries())) {
      const usersForShow = showToUsers.get(showId) || [];
      const showName = showEpisodes[0].showName;
      
      for (const userId of usersForShow) {
        // Apply intelligent grouping based on episode release patterns
        const groupedEpisodes = this.applyIntelligentGrouping(showEpisodes);
        
        // Create separate notification groups if episodes should be split
        for (const episodeGroup of groupedEpisodes) {
          groups.push({
            showId,
            showName,
            episodes: episodeGroup,
            userId,
          });
        }
      }
    }

    return groups;
  }

  /**
   * Apply intelligent grouping to episodes based on release patterns with enhanced logic
   */
  private applyIntelligentGrouping(episodes: NewEpisode[]): NewEpisode[][] {
    if (episodes.length <= 1) {
      return [episodes];
    }

    // Sort episodes by air date and episode number
    const sortedEpisodes = episodes.sort((a, b) => {
      const dateA = new Date(a.airDate).getTime();
      const dateB = new Date(b.airDate).getTime();
      
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // If same date, sort by season and episode
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      
      return a.episodeNumber - b.episodeNumber;
    });

    // Detect release patterns
    const releasePattern = this.detectReleasePattern(sortedEpisodes);
    
    const groups: NewEpisode[][] = [];
    let currentGroup: NewEpisode[] = [sortedEpisodes[0]];
    
    for (let i = 1; i < sortedEpisodes.length; i++) {
      const currentEpisode = sortedEpisodes[i];
      const lastEpisode = currentGroup[currentGroup.length - 1];
      
      const currentDate = new Date(currentEpisode.airDate);
      const lastDate = new Date(lastEpisode.airDate);
      const daysDifference = Math.abs(currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      
      let shouldGroup = false;
      let maxGroupSize = 10;

      // Apply grouping logic based on detected pattern
      switch (releasePattern.type) {
        case 'batch_release':
          // Large batch releases (Netflix-style) - group all episodes released within 3 days
          shouldGroup = daysDifference <= 3;
          maxGroupSize = 15; // Allow larger groups for batch releases
          break;
          
        case 'weekly_release':
          // Weekly releases - don't group unless same day
          shouldGroup = daysDifference === 0;
          maxGroupSize = 3; // Smaller groups for weekly releases
          break;
          
        case 'daily_release':
          // Daily releases - group consecutive days up to a week
          shouldGroup = daysDifference <= 1 && this.areConsecutiveEpisodes(lastEpisode, currentEpisode);
          maxGroupSize = 7; // One week worth of daily episodes
          break;
          
        case 'irregular':
        default:
          // Mixed pattern - use flexible grouping
          shouldGroup = 
            daysDifference === 0 || // Same day
            (daysDifference <= 3 && this.areConsecutiveEpisodes(lastEpisode, currentEpisode)) || // Close consecutive episodes
            (daysDifference <= 7 && currentGroup.length >= 4); // Batch release pattern
          maxGroupSize = 8;
          break;
      }

      // Additional grouping rules
      if (shouldGroup && currentGroup.length < maxGroupSize) {
        // Check for special episodes that should be grouped separately
        if (this.shouldSeparateSpecialEpisode(currentEpisode, lastEpisode)) {
          groups.push(currentGroup);
          currentGroup = [currentEpisode];
        } else {
          currentGroup.push(currentEpisode);
        }
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [currentEpisode];
      }
    }
    
    // Add the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Post-process groups to handle special cases
    return this.postProcessGroups(groups);
  }

  /**
   * Detect the release pattern of episodes
   */
  private detectReleasePattern(episodes: NewEpisode[]): { type: 'batch_release' | 'weekly_release' | 'daily_release' | 'irregular'; confidence: number } {
    if (episodes.length < 2) {
      return { type: 'irregular', confidence: 0 };
    }

    const dates = episodes.map(ep => new Date(ep.airDate).getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < dates.length; i++) {
      intervals.push(Math.abs(dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const maxInterval = Math.max(...intervals);

    // Batch release: Most episodes released within 3 days
    const batchReleaseCount = intervals.filter(interval => interval <= 3).length;
    if (batchReleaseCount / intervals.length >= 0.8) {
      return { type: 'batch_release', confidence: batchReleaseCount / intervals.length };
    }

    // Weekly release: Average interval around 7 days
    if (avgInterval >= 5 && avgInterval <= 9 && maxInterval <= 14) {
      const weeklyConfidence = 1 - Math.abs(avgInterval - 7) / 7;
      return { type: 'weekly_release', confidence: weeklyConfidence };
    }

    // Daily release: Average interval around 1 day
    if (avgInterval >= 0.5 && avgInterval <= 2 && maxInterval <= 3) {
      const dailyConfidence = 1 - Math.abs(avgInterval - 1);
      return { type: 'daily_release', confidence: dailyConfidence };
    }

    return { type: 'irregular', confidence: 0.5 };
  }

  /**
   * Check if a special episode should be separated from regular episodes
   */
  private shouldSeparateSpecialEpisode(currentEpisode: NewEpisode, lastEpisode: NewEpisode): boolean {
    const currentName = currentEpisode.episodeName.toLowerCase();
    const lastName = lastEpisode.episodeName.toLowerCase();

    // Separate finales from regular episodes
    if (currentName.includes('finale') && !lastName.includes('finale')) {
      return true;
    }

    // Separate premieres from regular episodes
    if (currentName.includes('premiere') && !lastName.includes('premiere')) {
      return true;
    }

    // Separate special episodes (specials, recaps, etc.)
    const specialKeywords = ['special', 'recap', 'behind the scenes', 'making of', 'deleted scenes'];
    const currentIsSpecial = specialKeywords.some(keyword => currentName.includes(keyword));
    const lastIsSpecial = specialKeywords.some(keyword => lastName.includes(keyword));
    
    if (currentIsSpecial !== lastIsSpecial) {
      return true;
    }

    // Separate different seasons
    if (currentEpisode.seasonNumber !== lastEpisode.seasonNumber) {
      return true;
    }

    return false;
  }

  /**
   * Post-process groups to handle edge cases and optimize notification delivery
   */
  private postProcessGroups(groups: NewEpisode[][]): NewEpisode[][] {
    const processedGroups: NewEpisode[][] = [];

    for (const group of groups) {
      if (group.length === 1) {
        // Single episodes stay as-is
        processedGroups.push(group);
      } else if (group.length <= 3) {
        // Small groups (2-3 episodes) - check if they should be split
        const hasFinale = group.some(ep => ep.episodeName.toLowerCase().includes('finale'));
        const hasPremiere = group.some(ep => ep.episodeName.toLowerCase().includes('premiere'));
        
        if (hasFinale && hasPremiere && group.length > 2) {
          // Split groups that have both finale and premiere
          const finaleIndex = group.findIndex(ep => ep.episodeName.toLowerCase().includes('finale'));
          const premiereIndex = group.findIndex(ep => ep.episodeName.toLowerCase().includes('premiere'));
          
          if (Math.abs(finaleIndex - premiereIndex) > 1) {
            // Split into separate notifications for finale and premiere
            processedGroups.push([group[finaleIndex]]);
            processedGroups.push([group[premiereIndex]]);
            
            // Add remaining episodes
            const remaining = group.filter((_, index) => index !== finaleIndex && index !== premiereIndex);
            if (remaining.length > 0) {
              processedGroups.push(remaining);
            }
          } else {
            processedGroups.push(group);
          }
        } else {
          processedGroups.push(group);
        }
      } else {
        // Large groups (4+ episodes) - keep as-is but ensure they don't exceed limits
        if (group.length > 15) {
          // Split very large groups
          const midpoint = Math.ceil(group.length / 2);
          processedGroups.push(group.slice(0, midpoint));
          processedGroups.push(group.slice(midpoint));
        } else {
          processedGroups.push(group);
        }
      }
    }

    return processedGroups;
  }

  /**
   * Check if two episodes are consecutive
   */
  private areConsecutiveEpisodes(episode1: NewEpisode, episode2: NewEpisode): boolean {
    // Same season, consecutive episode numbers
    if (episode1.seasonNumber === episode2.seasonNumber) {
      return Math.abs(episode1.episodeNumber - episode2.episodeNumber) === 1;
    }
    
    // Different seasons - check if it's season finale to season premiere
    if (episode2.seasonNumber === episode1.seasonNumber + 1) {
      return episode2.episodeNumber === 1; // New season starts
    }
    
    return false;
  }

  /**
   * Enhanced user preference filtering for episode notifications
   */
  private async shouldNotifyUser(
    preferences: NotificationPreferences | undefined, 
    userId: string, 
    showId: number,
    episodes?: NewEpisode[]
  ): Promise<boolean> {
    if (!preferences) {
      return true; // Default to sending notifications
    }

    // Check if episode notifications are enabled
    if (!preferences.episodeReleases) {
      console.log(`[EpisodeNotifications] Episode notifications disabled for user ${userId}`);
      return false;
    }

    // Check show status - don't notify for completed or dropped shows
    try {
      const { data: showProgress, error } = await supabase
        .from('show_progress')
        .select('status, last_watched_date, current_season, current_episode')
        .eq('user_id', userId)
        .eq('show_id', showId)
        .single();

      if (!error && showProgress) {
        const status = showProgress.status;
        
        // Don't notify for completed or dropped shows
        if (status === 'completed' || status === 'dropped') {
          console.log(`[EpisodeNotifications] Skipping notification for user ${userId}, show ${showId} - status: ${status}`);
          return false;
        }

        // For shows marked as "up_to_date", only notify for new episodes beyond current progress
        if (status === 'up_to_date' && episodes && episodes.length > 0) {
          const userCurrentSeason = showProgress.current_season || 1;
          const userCurrentEpisode = showProgress.current_episode || 0;
          
          // Check if any of the new episodes are actually new for this user
          const hasNewEpisodes = episodes.some(episode => {
            return episode.seasonNumber > userCurrentSeason || 
                   (episode.seasonNumber === userCurrentSeason && episode.episodeNumber > userCurrentEpisode);
          });

          if (!hasNewEpisodes) {
            console.log(`[EpisodeNotifications] No new episodes for user ${userId}, show ${showId} - already up to date`);
            return false;
          }
        }

        // Check if user has been inactive for too long (optional preference-based filtering)
        if (showProgress.last_watched_date) {
          const lastWatchedDate = new Date(showProgress.last_watched_date);
          const daysSinceLastWatch = (Date.now() - lastWatchedDate.getTime()) / (1000 * 60 * 60 * 24);
          
          // If user hasn't watched in 90+ days and frequency is not immediate, reduce notification priority
          if (daysSinceLastWatch > 90 && preferences.frequency !== 'immediate') {
            console.log(`[EpisodeNotifications] User ${userId} inactive for ${Math.round(daysSinceLastWatch)} days on show ${showId}`);
            
            // For very inactive users, only notify for premieres and finales
            if (episodes && episodes.length > 0) {
              const hasSpecialEpisodes = episodes.some(episode => {
                const episodeName = episode.episodeName.toLowerCase();
                return episodeName.includes('premiere') || episodeName.includes('finale');
              });
              
              if (!hasSpecialEpisodes) {
                console.log(`[EpisodeNotifications] Skipping regular episode notification for inactive user ${userId}`);
                return false;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[EpisodeNotifications] Could not check show status for user ${userId}, show ${showId}:`, error);
      // Continue with notification if we can't determine status
    }

    // Check if show is still in user's watchlist (additional safety check)
    try {
      const { data: watchlistItem, error } = await supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', userId)
        .eq('tmdb_id', showId)
        .eq('media_type', 'tv')
        .single();

      if (error || !watchlistItem) {
        console.log(`[EpisodeNotifications] Show ${showId} not in watchlist for user ${userId}`);
        return false;
      }
    } catch (error) {
      console.warn(`[EpisodeNotifications] Could not verify watchlist status for user ${userId}, show ${showId}:`, error);
      // Continue with notification if we can't verify watchlist status
    }

    // Check notification frequency and timing preferences
    if (preferences.frequency === 'weekly' || preferences.frequency === 'daily') {
      // For non-immediate frequencies, we'll handle this in the scheduling logic
      // but still allow the notification to be generated
      return true;
    }

    // Check quiet hours for immediate notifications
    if (preferences.frequency === 'immediate' && preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
      
      const quietStart = startHour * 60 + startMin;
      const quietEnd = endHour * 60 + endMin;
      
      // Check if we're in quiet hours
      const isInQuietHours = quietStart <= quietEnd 
        ? (currentTime >= quietStart && currentTime <= quietEnd)
        : (currentTime >= quietStart || currentTime <= quietEnd);
      
      if (isInQuietHours) {
        console.log(`[EpisodeNotifications] In quiet hours for user ${userId}, will schedule for later`);
        // Don't block the notification, just let the scheduling logic handle it
      }
    }

    return true;
  }

  /**
   * Enhanced preference filtering for episode groups
   */
  private async filterEpisodesByPreferences(
    episodes: NewEpisode[],
    userId: string,
    preferences: NotificationPreferences
  ): Promise<NewEpisode[]> {
    if (!preferences.episodeReleases) {
      return [];
    }

    // Get user's show progress to filter out already watched episodes
    const showIds = Array.from(new Set(episodes.map(ep => ep.showId)));
    
    try {
      const { data: progressData, error } = await supabase
        .from('episode_progress')
        .select('show_id, season_number, episode_number, watched')
        .eq('user_id', userId)
        .in('show_id', showIds);

      if (!error && progressData) {
        // Create a set of watched episodes for quick lookup
        const watchedEpisodes = new Set(
          progressData
            .filter(p => p.watched)
            .map(p => `${p.show_id}-${p.season_number}-${p.episode_number}`)
        );

        // Filter out already watched episodes
        const unwatchedEpisodes = episodes.filter(episode => {
          const episodeKey = `${episode.showId}-${episode.seasonNumber}-${episode.episodeNumber}`;
          return !watchedEpisodes.has(episodeKey);
        });

        console.log(`[EpisodeNotifications] Filtered ${episodes.length - unwatchedEpisodes.length} already watched episodes for user ${userId}`);
        return unwatchedEpisodes;
      }
    } catch (error) {
      console.warn(`[EpisodeNotifications] Could not filter watched episodes for user ${userId}:`, error);
    }

    // If we can't determine watched status, return all episodes
    return episodes;
  }

  /**
   * Get episode context for enhanced notification templates
   */
  private async getEpisodeContext(group: EpisodeNotificationGroup): Promise<EpisodeNotificationContext> {
    const context: EpisodeNotificationContext = {
      isSeasonFinale: false,
      isSeriesFinale: false,
      isSeasonPremiere: false,
      isSeriesPremiere: false,
    };

    try {
      // Check if any episode is a finale or premiere
      for (const episode of group.episodes) {
        const episodeName = episode.episodeName.toLowerCase();
        
        // Check for finale indicators
        if (episodeName.includes('finale') || episodeName.includes('final')) {
          if (episodeName.includes('series') || episodeName.includes('show')) {
            context.isSeriesFinale = true;
          } else {
            context.isSeasonFinale = true;
          }
        }
        
        // Check for premiere indicators
        if (episodeName.includes('premiere') || episodeName.includes('pilot')) {
          if (episode.seasonNumber === 1 && episode.episodeNumber === 1) {
            context.isSeriesPremiere = true;
          } else {
            context.isSeasonPremiere = true;
          }
        }
      }

      // Get additional context from TMDB if needed
      const firstEpisode = group.episodes[0];
      try {
        const { data: seasonData, error } = await supabase
          .from('episode_cache')
          .select('episode_count')
          .eq('show_id', group.showId)
          .eq('season_number', firstEpisode.seasonNumber)
          .single();

        if (!error && seasonData) {
          context.totalEpisodesInSeason = seasonData.episode_count;
          
          // Check if this is the last episode of the season
          const maxEpisodeNumber = Math.max(...group.episodes.map(ep => ep.episodeNumber));
          if (maxEpisodeNumber === seasonData.episode_count) {
            context.isSeasonFinale = true;
          }
        }
      } catch (error) {
        console.warn('[EpisodeNotifications] Could not get season context:', error);
      }

    } catch (error) {
      console.warn('[EpisodeNotifications] Error getting episode context:', error);
    }

    return context;
  }

  /**
   * Create enhanced notification template for episode group with improved templates
   */
  private async createNotificationTemplate(
    group: EpisodeNotificationGroup, 
    context: EpisodeNotificationContext
  ): Promise<NotificationTemplate> {
    // Sort episodes by season and episode number
    const sortedEpisodes = group.episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      return a.episodeNumber - b.episodeNumber;
    });

    const firstEpisode = sortedEpisodes[0];
    const episodeCount = group.episodes.length;

    let title: string;
    let body: string;
    let priority: 'high' | 'normal' | 'low' = 'normal';
    let category = 'episode_release';
    let badge = episodeCount;
    let sound = 'default';
    let image: string | undefined;

    // Use episode still image if available
    if (firstEpisode.stillPath) {
      image = `https://image.tmdb.org/t/p/w500${firstEpisode.stillPath}`;
    }

    // Create notification actions with enhanced options
    const actions: NotificationAction[] = [
      {
        id: 'view_episode',
        title: episodeCount === 1 ? 'View Episode' : 'View Episodes',
        type: 'foreground',
      },
      {
        id: 'mark_watched',
        title: episodeCount === 1 ? 'Mark as Watched' : `Mark All ${episodeCount} Watched`,
        type: 'background',
      },
    ];

    // Add "Add to Queue" action for multiple episodes
    if (episodeCount > 1) {
      actions.push({
        id: 'add_to_queue',
        title: 'Add to Queue',
        type: 'background',
      });
    }

    if (episodeCount === 1) {
      // Enhanced single episode notification templates
      if (context.isSeriesPremiere) {
        title = `🎬 Series Premiere: ${group.showName}`;
        body = `The new series starts now! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
        priority = 'high';
        category = 'series_premiere';
        sound = 'premiere';
        badge = 1;
      } else if (context.isSeasonPremiere) {
        title = `🎉 Season ${firstEpisode.seasonNumber} Premiere: ${group.showName}`;
        body = `New season is here! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
        priority = 'high';
        category = 'season_premiere';
        sound = 'premiere';
        badge = 1;
      } else if (context.isSeriesFinale) {
        title = `🏁 Series Finale: ${group.showName}`;
        body = `The final episode! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
        priority = 'high';
        category = 'series_finale';
        sound = 'finale';
        badge = 1;
      } else if (context.isSeasonFinale) {
        title = `🎭 Season Finale: ${group.showName}`;
        body = `Season ${firstEpisode.seasonNumber} finale! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
        priority = 'high';
        category = 'season_finale';
        sound = 'finale';
        badge = 1;
      } else {
        // Regular episode with enhanced context
        title = `📺 New Episode: ${group.showName}`;
        body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
        
        // Add contextual information
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (firstEpisode.airDate === today) {
          body += ` • Aired today`;
          priority = 'high';
        } else if (firstEpisode.airDate === yesterday) {
          body += ` • Aired yesterday`;
        }

        // Add episode position context if available
        if (context.totalEpisodesInSeason) {
          const progress = Math.round((firstEpisode.episodeNumber / context.totalEpisodesInSeason) * 100);
          if (progress >= 75) {
            body += ` • Season ${progress}% complete`;
          }
        }
        
        badge = 1;
      }
    } else {
      // Enhanced multiple episodes notification templates
      const lastEpisode = sortedEpisodes[episodeCount - 1];
      const isMultiSeason = firstEpisode.seasonNumber !== lastEpisode.seasonNumber;
      
      if (episodeCount >= 8) {
        // Full season or large batch release
        title = `🍿 ${episodeCount} Episodes Available: ${group.showName}`;
        if (isMultiSeason) {
          body = `Binge time! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} - S${lastEpisode.seasonNumber}E${lastEpisode.episodeNumber}`;
        } else {
          body = `Full season drop! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}-${lastEpisode.episodeNumber}`;
        }
        priority = 'high';
        category = 'batch_release';
        sound = 'batch_release';
        badge = episodeCount;
      } else if (episodeCount >= 4) {
        // Medium batch release
        title = `🎬 ${episodeCount} Episodes Available: ${group.showName}`;
        if (isMultiSeason) {
          body = `Multiple episodes ready! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} - S${lastEpisode.seasonNumber}E${lastEpisode.episodeNumber}`;
        } else {
          body = `Multiple episodes ready! S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}-${lastEpisode.episodeNumber}`;
        }
        priority = 'high';
        category = 'multi_episode';
        badge = episodeCount;
      } else {
        // Small batch (2-3 episodes)
        title = `📺 ${episodeCount} New Episodes: ${group.showName}`;
        if (isMultiSeason) {
          body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} - S${lastEpisode.seasonNumber}E${lastEpisode.episodeNumber}`;
        } else {
          body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}-${lastEpisode.episodeNumber}`;
        }
        
        // Add timing context for small batches
        const allSameDay = sortedEpisodes.every(ep => ep.airDate === firstEpisode.airDate);
        if (allSameDay) {
          const today = new Date().toISOString().split('T')[0];
          if (firstEpisode.airDate === today) {
            body += ` • All aired today`;
            priority = 'high';
          }
        }
        
        badge = episodeCount;
      }

      // Add special context for finale episodes in batch
      if (context.isSeasonFinale || context.isSeriesFinale) {
        if (context.isSeriesFinale) {
          body += ` • Includes series finale!`;
          sound = 'finale';
        } else if (context.isSeasonFinale) {
          body += ` • Includes season finale!`;
          sound = 'finale';
        }
        priority = 'high';
      }
    }

    return {
      title,
      body,
      priority,
      category,
      actions,
      badge,
      sound,
      image,
      data: {
        type: 'episode_release',
        category,
        showId: group.showId,
        showName: group.showName,
        episodes: sortedEpisodes.map(ep => ({
          season: ep.seasonNumber,
          episode: ep.episodeNumber,
          name: ep.episodeName,
          airDate: ep.airDate,
          overview: ep.overview,
          stillPath: ep.stillPath,
        })),
        totalEpisodes: episodeCount,
        context: {
          isSeasonFinale: context.isSeasonFinale,
          isSeriesFinale: context.isSeriesFinale,
          isSeasonPremiere: context.isSeasonPremiere,
          isSeriesPremiere: context.isSeriesPremiere,
          totalEpisodesInSeason: context.totalEpisodesInSeason,
        },
        // Enhanced deep link data for navigation
        deepLink: {
          screen: episodeCount === 1 ? 'EpisodeDetails' : 'ShowDetails',
          params: {
            showId: group.showId,
            showName: group.showName,
            ...(episodeCount === 1 && {
              seasonNumber: firstEpisode.seasonNumber,
              episodeNumber: firstEpisode.episodeNumber,
            }),
          },
        },
        // Notification interaction tracking
        tracking: {
          notificationId: `episode_${group.showId}_${Date.now()}`,
          userId: group.userId,
          episodeCount,
          category,
          createdAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Calculate when to send notification based on user preferences
   */
  private calculateScheduleTime(preferences?: NotificationPreferences): Date {
    const now = new Date();
    
    if (!preferences) {
      return now; // Send immediately if no preferences
    }

    // Handle frequency preferences
    let baseScheduleTime = now;
    
    switch (preferences.frequency) {
      case 'daily':
        // Schedule for next day at 9 AM
        baseScheduleTime = new Date(now);
        baseScheduleTime.setDate(baseScheduleTime.getDate() + 1);
        baseScheduleTime.setHours(9, 0, 0, 0);
        break;
        
      case 'weekly':
        // Schedule for next Monday at 9 AM
        baseScheduleTime = new Date(now);
        const daysUntilMonday = (8 - baseScheduleTime.getDay()) % 7 || 7;
        baseScheduleTime.setDate(baseScheduleTime.getDate() + daysUntilMonday);
        baseScheduleTime.setHours(9, 0, 0, 0);
        break;
        
      case 'immediate':
      default:
        baseScheduleTime = now;
        break;
    }

    // Apply quiet hours if enabled
    if (preferences.quietHours.enabled && preferences.frequency === 'immediate') {
      const { start, end } = preferences.quietHours;
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      
      const currentHour = baseScheduleTime.getHours();
      const currentMin = baseScheduleTime.getMinutes();
      const currentTime = currentHour * 60 + currentMin;
      const quietStartTime = startHour * 60 + startMin;
      const quietEndTime = endHour * 60 + endMin;
      
      // Handle quiet hours that span midnight
      const isInQuietHours = quietStartTime > quietEndTime
        ? (currentTime >= quietStartTime || currentTime < quietEndTime)
        : (currentTime >= quietStartTime && currentTime < quietEndTime);
      
      if (isInQuietHours) {
        // Schedule for end of quiet hours
        const scheduleDate = new Date(baseScheduleTime);
        scheduleDate.setHours(endHour, endMin, 0, 0);
        
        // If end time is tomorrow (quiet hours span midnight)
        if (quietStartTime > quietEndTime && currentTime >= quietStartTime) {
          scheduleDate.setDate(scheduleDate.getDate() + 1);
        }
        
        return scheduleDate;
      }
    }
    
    return baseScheduleTime;
  }

  /**
   * Send notification to user
   */
  private async sendNotification(
    userId: string, 
    template: NotificationTemplate, 
    scheduledFor: Date
  ): Promise<void> {
    try {
      // Create local notification
      const localNotification: LocalNotification = {
        id: `episode_${template.data.showId}_${userId}_${Date.now()}`,
        title: template.title,
        body: template.body,
        data: template.data,
      };

      // If scheduled for future, set trigger
      if (scheduledFor > new Date()) {
        localNotification.trigger = {
          date: scheduledFor,
        };
      }

      // Send local notification
      await notificationManager.scheduleLocalNotification(localNotification);
      
      // Store in database for history and cross-device sync
      await notificationHistoryService.storeNotification({
        user_id: userId,
        type: 'episode_release',
        title: template.title,
        body: template.body,
        data: template.data,
        scheduled_for: scheduledFor > new Date() ? scheduledFor.toISOString() : undefined,
        priority: template.priority,
        status: 'sent',
      });
      
      console.log(`[EpisodeNotifications] Notification scheduled for user ${userId}: ${template.title}`);
      
    } catch (error) {
      console.error(`[EpisodeNotifications] Failed to send notification to user ${userId}:`, error);
      throw error;
    }
  }



  /**
   * Create notification for a single episode (utility method)
   */
  async createSingleEpisodeNotification(
    userId: string,
    episode: NewEpisode,
    preferences?: NotificationPreferences
  ): Promise<void> {
    if (!(await this.shouldNotifyUser(preferences, userId, episode.showId))) {
      return;
    }

    const group: EpisodeNotificationGroup = {
      showId: episode.showId,
      showName: episode.showName,
      episodes: [episode],
      userId,
    };

    const context = await this.getEpisodeContext(group);
    const template = await this.createNotificationTemplate(group, context);
    const scheduledFor = this.calculateScheduleTime(preferences);
    
    await this.sendNotification(userId, template, scheduledFor);
  }

  /**
   * Customize notification template based on user preferences and history
   */
  private async customizeNotificationForUser(
    template: NotificationTemplate,
    userId: string,
    preferences: NotificationPreferences
  ): Promise<NotificationTemplate> {
    try {
      // Get user's notification interaction history for personalization
      const { data: interactionHistory } = await supabase
        .from('notification_interactions')
        .select('action_type, notification_category')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Customize based on user behavior
      if (interactionHistory && interactionHistory.length > 0) {
        const recentInteractions = interactionHistory.slice(0, 10);
        const dismissalRate = recentInteractions.filter(i => i.action_type === 'dismissed').length / recentInteractions.length;
        
        // If user frequently dismisses notifications, make them more concise
        if (dismissalRate > 0.7) {
          template.title = template.title.replace(/🎬|🎉|🏁|🎭|📺|🍿/g, '').trim();
          template.body = template.body.split('•')[0].trim(); // Remove additional context
          template.priority = 'low';
        }
        
        // If user frequently interacts with finale notifications, prioritize them
        const finaleInteractions = recentInteractions.filter(i => 
          i.notification_category === 'season_finale' || i.notification_category === 'series_finale'
        );
        if (finaleInteractions.length > 0 && template.category?.includes('finale')) {
          template.priority = 'high';
          template.sound = 'finale';
        }
      }

      // Customize based on frequency preference
      if (preferences.frequency === 'weekly' || preferences.frequency === 'daily') {
        // For digest users, add summary information
        template.body += ` • Part of your ${preferences.frequency} digest`;
      }

      return template;
    } catch (error) {
      console.warn('[EpisodeNotifications] Could not customize notification for user:', error);
      return template;
    }
  }

  /**
   * Generate notification templates for different episode types
   */
  async generateNotificationTemplates(
    episodes: NewEpisode[],
    userId: string,
    preferences?: NotificationPreferences
  ): Promise<NotificationTemplate[]> {
    try {
      const templates: NotificationTemplate[] = [];
      
      // Group episodes by show
      const episodesByShow = new Map<number, NewEpisode[]>();
      episodes.forEach(episode => {
        if (!episodesByShow.has(episode.showId)) {
          episodesByShow.set(episode.showId, []);
        }
        episodesByShow.get(episode.showId)!.push(episode);
      });

      // Generate templates for each show
      for (const [showId, showEpisodes] of Array.from(episodesByShow.entries())) {
        // Apply intelligent grouping
        const groupedEpisodes = this.applyIntelligentGrouping(showEpisodes);
        
        for (const episodeGroup of groupedEpisodes) {
          const group: EpisodeNotificationGroup = {
            showId,
            showName: episodeGroup[0].showName,
            episodes: episodeGroup,
            userId,
          };

          const context = await this.getEpisodeContext(group);
          let template = await this.createNotificationTemplate(group, context);
          
          // Customize template for user if preferences available
          if (preferences) {
            template = await this.customizeNotificationForUser(template, userId, preferences);
          }
          
          templates.push(template);
        }
      }

      return templates;
    } catch (error) {
      console.error('[EpisodeNotifications] Error generating notification templates:', error);
      return [];
    }
  }

  /**
   * Test notification generation with different templates (for debugging)
   */
  async sendTestEpisodeNotification(userId: string, testType: 'single' | 'batch' | 'finale' | 'premiere' = 'single'): Promise<void> {
    try {
      let testEpisodes: NewEpisode[] = [];

      switch (testType) {
        case 'single':
          testEpisodes = [{
            showId: 12345,
            showName: 'Test Show',
            seasonNumber: 1,
            episodeNumber: 5,
            episodeName: 'Test Episode',
            airDate: new Date().toISOString().split('T')[0],
            overview: 'This is a test episode notification.',
            stillPath: null,
          }];
          break;

        case 'batch':
          testEpisodes = Array.from({ length: 8 }, (_, i) => ({
            showId: 12345,
            showName: 'Test Show',
            seasonNumber: 2,
            episodeNumber: i + 1,
            episodeName: `Episode ${i + 1}`,
            airDate: new Date().toISOString().split('T')[0],
            overview: `Test batch episode ${i + 1}.`,
            stillPath: null,
          }));
          break;

        case 'finale':
          testEpisodes = [{
            showId: 12345,
            showName: 'Test Show',
            seasonNumber: 3,
            episodeNumber: 10,
            episodeName: 'Season Finale',
            airDate: new Date().toISOString().split('T')[0],
            overview: 'This is a test season finale notification.',
            stillPath: null,
          }];
          break;

        case 'premiere':
          testEpisodes = [{
            showId: 12345,
            showName: 'Test Show',
            seasonNumber: 4,
            episodeNumber: 1,
            episodeName: 'Season Premiere',
            airDate: new Date().toISOString().split('T')[0],
            overview: 'This is a test season premiere notification.',
            stillPath: null,
          }];
          break;
      }

      const templates = await this.generateNotificationTemplates(testEpisodes, userId);
      
      for (const template of templates) {
        const localNotification: LocalNotification = {
          id: `test_${testType}_${Date.now()}`,
          title: template.title,
          body: template.body,
          data: template.data,
        };

        await notificationManager.scheduleLocalNotification(localNotification);
      }
      
      console.log(`[EpisodeNotifications] Test ${testType} notification(s) sent: ${templates.length} templates`);
    } catch (error) {
      console.error('[EpisodeNotifications] Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Generate digest notification for weekly frequency users
   */
  async generateWeeklyDigest(userId: string): Promise<void> {
    try {
      console.log(`[EpisodeNotifications] Generating weekly digest for user ${userId}`);
      
      // Get user preferences
      const userPrefs = await this.getUserNotificationPreferences([userId]);
      const preferences = userPrefs.get(userId);
      
      if (!preferences || preferences.frequency !== 'weekly' || !preferences.episodeReleases) {
        return;
      }

      // Get episodes from the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: userShows, error: showsError } = await supabase
        .from('watchlists')
        .select('tmdb_id')
        .eq('user_id', userId)
        .eq('media_type', 'tv');

      if (showsError || !userShows || userShows.length === 0) {
        console.log(`[EpisodeNotifications] No shows in watchlist for user ${userId}`);
        return;
      }

      const showIds = userShows.map(s => s.tmdb_id);
      
      // Get episodes from cache that aired in the past week
      const { data: weeklyEpisodes, error: episodesError } = await supabase
        .from('episode_cache')
        .select('*')
        .in('show_id', showIds)
        .gte('air_date', oneWeekAgo.toISOString().split('T')[0])
        .order('air_date', { ascending: false });

      if (episodesError || !weeklyEpisodes || weeklyEpisodes.length === 0) {
        console.log(`[EpisodeNotifications] No new episodes this week for user ${userId}`);
        return;
      }

      // Convert to NewEpisode format
      const newEpisodes: NewEpisode[] = weeklyEpisodes.map(ep => ({
        showId: ep.show_id,
        showName: ep.show_name,
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        episodeName: ep.name,
        airDate: ep.air_date,
        overview: ep.overview || '',
        stillPath: ep.still_path,
      }));

      // Group by show
      const episodesByShow = new Map<number, NewEpisode[]>();
      newEpisodes.forEach(episode => {
        if (!episodesByShow.has(episode.showId)) {
          episodesByShow.set(episode.showId, []);
        }
        episodesByShow.get(episode.showId)!.push(episode);
      });

      if (episodesByShow.size === 0) {
        return;
      }

      // Create digest notification
      const totalEpisodes = newEpisodes.length;
      const showCount = episodesByShow.size;
      
      let title: string;
      let body: string;
      
      if (showCount === 1) {
        const showName = newEpisodes[0].showName;
        title = `📺 Weekly Update: ${showName}`;
        body = totalEpisodes === 1 
          ? `1 new episode this week`
          : `${totalEpisodes} new episodes this week`;
      } else {
        title = `📺 Weekly Episode Digest`;
        body = `${totalEpisodes} new episodes from ${showCount} shows this week`;
      }

      const digestTemplate: NotificationTemplate = {
        title,
        body,
        priority: 'normal',
        category: 'weekly_digest',
        data: {
          type: 'episode_release',
          category: 'weekly_digest',
          totalEpisodes,
          showCount,
          shows: Array.from(episodesByShow.entries()).map(([showId, episodes]) => ({
            showId,
            showName: episodes[0].showName,
            episodeCount: episodes.length,
            episodes: episodes.map(ep => ({
              season: ep.seasonNumber,
              episode: ep.episodeNumber,
              name: ep.episodeName,
              airDate: ep.airDate,
            })),
          })),
          deepLink: {
            screen: 'WeeklyDigest',
            params: { userId },
          },
        },
      };

      // Send digest notification
      await this.sendNotification(userId, digestTemplate, new Date());
      
      console.log(`[EpisodeNotifications] Weekly digest sent to user ${userId}: ${totalEpisodes} episodes from ${showCount} shows`);
      
    } catch (error) {
      console.error(`[EpisodeNotifications] Error generating weekly digest for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get notification statistics for debugging
   */
  async getNotificationStats(userId: string): Promise<{
    totalSent: number;
    pendingNotifications: number;
    lastNotificationDate?: string;
    weeklyDigestEnabled: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('status, created_at, data')
        .eq('user_id', userId)
        .eq('type', 'episode_release');

      if (error) {
        throw new Error(`Failed to fetch notification stats: ${error.message}`);
      }

      const notifications = data || [];
      const totalSent = notifications.filter(n => n.status === 'sent').length;
      const pendingNotifications = notifications.filter(n => n.status === 'pending').length;
      
      const lastNotification = notifications
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      // Check if user has weekly digest enabled
      const userPrefs = await this.getUserNotificationPreferences([userId]);
      const preferences = userPrefs.get(userId);
      const weeklyDigestEnabled = preferences?.frequency === 'weekly' && preferences?.episodeReleases;

      return {
        totalSent,
        pendingNotifications,
        lastNotificationDate: lastNotification?.created_at,
        weeklyDigestEnabled: weeklyDigestEnabled || false,
      };
    } catch (error) {
      console.error('[EpisodeNotifications] Error getting notification stats:', error);
      return {
        totalSent: 0,
        pendingNotifications: 0,
        weeklyDigestEnabled: false,
      };
    }
  }
}

// Export singleton instance
export const episodeNotificationService = new EpisodeNotificationService();