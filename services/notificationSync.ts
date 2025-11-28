import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { realTimeManager } from './realtime';
import type { NotificationPreferences } from '../types';

export class NotificationSyncService {
  private readonly SYNC_KEY = 'notification_preferences_sync';
  private isInitialized = false;
  private currentUserId?: string;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id;

      if (this.currentUserId) {
        // Set up real-time subscription for preference changes
        this.subscribeToPreferenceChanges();
        
        // Perform initial sync
        await this.syncPreferences();
      }

      this.isInitialized = true;
      console.log('NotificationSyncService initialized');
    } catch (error) {
      console.error('Failed to initialize NotificationSyncService:', error);
    }
  }

  private subscribeToPreferenceChanges(): void {
    if (!this.currentUserId) return;

    // Subscribe to real-time changes in notification preferences
    const subscription = supabase
      .channel('notification_preferences_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_preferences',
          filter: `user_id=eq.${this.currentUserId}`,
        },
        (payload) => {
          console.log('Notification preferences changed:', payload);
          this.handleRemotePreferenceChange(payload);
        }
      )
      .subscribe();

    console.log('Subscribed to notification preference changes');
  }

  private async handleRemotePreferenceChange(payload: any): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const rawData = payload.new;
        
        // Map database columns to TypeScript interface
        const remotePrefs: NotificationPreferences = {
          userId: rawData.user_id,
          episodeReleases: rawData.episode_releases,
          streamingUpdates: rawData.streaming_updates,
          recommendations: rawData.recommendations,
          progressSync: rawData.progress_sync,
          quietHours: rawData.quiet_hours || {
            enabled: false,
            start: '22:00',
            end: '08:00',
          },
          frequency: rawData.frequency,
          updatedAt: rawData.updated_at,
        };
        
        // Get local preferences
        const localPrefs = await this.getLocalPreferences();
        
        // Check if remote preferences are newer
        if (!localPrefs || new Date(remotePrefs.updatedAt) > new Date(localPrefs.updatedAt)) {
          // Update local preferences
          await this.saveLocalPreferences(remotePrefs);
          console.log('Updated local preferences from remote change');
        }
      }
    } catch (error) {
      console.error('Error handling remote preference change:', error);
    }
  }

  async syncPreferences(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      // Get local and remote preferences
      const [localPrefs, remotePrefs] = await Promise.all([
        this.getLocalPreferences(),
        this.getRemotePreferences(),
      ]);

      if (!localPrefs && !remotePrefs) {
        // No preferences exist, create default
        const defaultPrefs = this.getDefaultPreferences();
        await this.saveRemotePreferences(defaultPrefs);
        await this.saveLocalPreferences(defaultPrefs);
        return;
      }

      if (!localPrefs && remotePrefs) {
        // Only remote exists, sync to local
        await this.saveLocalPreferences(remotePrefs);
        return;
      }

      if (localPrefs && !remotePrefs) {
        // Only local exists, sync to remote
        await this.saveRemotePreferences(localPrefs);
        return;
      }

      if (localPrefs && remotePrefs) {
        // Both exist, use the newer one
        const localTime = new Date(localPrefs.updatedAt);
        const remoteTime = new Date(remotePrefs.updatedAt);

        if (localTime > remoteTime) {
          // Local is newer, sync to remote
          await this.saveRemotePreferences(localPrefs);
        } else if (remoteTime > localTime) {
          // Remote is newer, sync to local
          await this.saveLocalPreferences(remotePrefs);
        }
        // If times are equal, no sync needed
      }

      console.log('Notification preferences synced successfully');
    } catch (error) {
      console.error('Error syncing notification preferences:', error);
    }
  }

  async updatePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      const updatedPrefs = {
        ...preferences,
        updatedAt: new Date().toISOString(),
      };

      // Save locally first for immediate UI update
      await this.saveLocalPreferences(updatedPrefs);

      // Then sync to remote
      await this.saveRemotePreferences(updatedPrefs);

      console.log('Notification preferences updated and synced');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      // Try local first for immediate response
      let preferences = await this.getLocalPreferences();

      if (!preferences) {
        // Fallback to remote
        preferences = await this.getRemotePreferences();
        
        if (preferences) {
          // Cache locally
          await this.saveLocalPreferences(preferences);
        }
      }

      // Trigger background sync to ensure consistency
      this.syncPreferences().catch(err => 
        console.error('Background sync failed:', err)
      );

      return preferences || this.getDefaultPreferences();
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  private async getLocalPreferences(): Promise<NotificationPreferences | null> {
    try {
      if (!this.currentUserId) return null;

      const data = await AsyncStorage.getItem(
        `notification_preferences_${this.currentUserId}`
      );
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting local preferences:', error);
      return null;
    }
  }

  private async saveLocalPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      if (!this.currentUserId) return;

      await AsyncStorage.setItem(
        `notification_preferences_${this.currentUserId}`,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Error saving local preferences:', error);
      throw error;
    }
  }

  private async getRemotePreferences(): Promise<NotificationPreferences | null> {
    try {
      if (!this.currentUserId) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', this.currentUserId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (!data) return null;

      // Map database columns to TypeScript interface
      return {
        userId: data.user_id,
        episodeReleases: data.episode_releases,
        streamingUpdates: data.streaming_updates,
        recommendations: data.recommendations,
        progressSync: data.progress_sync,
        quietHours: data.quiet_hours || {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        frequency: data.frequency,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Error getting remote preferences:', error);
      return null;
    }
  }

  private async saveRemotePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      if (!this.currentUserId) return;

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: this.currentUserId,
          episode_releases: preferences.episodeReleases,
          streaming_updates: preferences.streamingUpdates,
          recommendations: preferences.recommendations,
          progress_sync: preferences.progressSync,
          quiet_hours: {
            enabled: preferences.quietHours.enabled,
            start: preferences.quietHours.start,
            end: preferences.quietHours.end,
          },
          frequency: preferences.frequency,
          updated_at: preferences.updatedAt,
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving remote preferences:', error);
      throw error;
    }
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      userId: this.currentUserId || '',
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

  // Method to handle user logout
  async cleanup(): Promise<void> {
    try {
      // Clear local preferences
      if (this.currentUserId) {
        await AsyncStorage.removeItem(`notification_preferences_${this.currentUserId}`);
      }
      
      this.currentUserId = undefined;
      this.isInitialized = false;
      
      console.log('NotificationSyncService cleaned up');
    } catch (error) {
      console.error('Error cleaning up NotificationSyncService:', error);
    }
  }

  // Method to force sync (useful for manual refresh)
  async forceSyncFromRemote(): Promise<NotificationPreferences | null> {
    try {
      const remotePrefs = await this.getRemotePreferences();
      
      if (remotePrefs) {
        await this.saveLocalPreferences(remotePrefs);
      }
      
      return remotePrefs;
    } catch (error) {
      console.error('Error force syncing from remote:', error);
      return null;
    }
  }
}

export const notificationSyncService = new NotificationSyncService();