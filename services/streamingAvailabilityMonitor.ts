import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import { StreamingOption, WatchlistItem, UserPreferences } from '../types';

interface StreamingAvailabilityChange {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  changeType: 'added' | 'removed' | 'leaving_soon';
  service: {
    id: string;
    name: string;
  };
  previousAvailability: StreamingOption[];
  currentAvailability: StreamingOption[];
  detectedAt: string;
  leavingDate?: string; // For leaving_soon notifications
}

interface AvailabilityCache {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  availability: StreamingOption[];
  lastChecked: string;
  checksum: string; // Hash of availability data for change detection
}

class StreamingAvailabilityMonitorService {
  private readonly CACHE_KEY = 'streaming_availability_cache';
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
  private readonly CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start periodic monitoring of streaming availability changes
   */
  private startMonitoring(): void {
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Start monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllWatchlistAvailability().catch(error => {
        console.error('Error in periodic availability check:', error);
      });
    }, this.CHECK_INTERVAL);

    // Run initial check after a short delay
    setTimeout(() => {
      this.checkAllWatchlistAvailability().catch(error => {
        console.error('Error in initial availability check:', error);
      });
    }, 5000);
  }

  /**
   * Stop monitoring (useful for cleanup)
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Check availability changes for all items in user's watchlist
   */
  async checkAllWatchlistAvailability(): Promise<StreamingAvailabilityChange[]> {
    try {
      const watchlist = await storageService.getWatchlist();
      const changes: StreamingAvailabilityChange[] = [];

      // Process in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < watchlist.length; i += batchSize) {
        const batch = watchlist.slice(i, i + batchSize);
        const batchPromises = batch.map(item => 
          this.checkItemAvailability(item).catch(error => {
            console.error(`Error checking availability for ${item.title}:`, error);
            return null;
          })
        );

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(result => result !== null) as StreamingAvailabilityChange[];
        changes.push(...validResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < watchlist.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Store changes for notification processing
      if (changes.length > 0) {
        await this.storeAvailabilityChanges(changes);
      }

      return changes;
    } catch (error) {
      console.error('Error checking watchlist availability:', error);
      return [];
    }
  }

  /**
   * Check availability changes for a specific watchlist item
   */
  async checkItemAvailability(item: WatchlistItem): Promise<StreamingAvailabilityChange | null> {
    try {
      // Get cached availability data
      const cachedData = await this.getCachedAvailability(item.id, item.type);
      
      // Check if we need to fetch fresh data
      const shouldFetch = !cachedData || 
        (Date.now() - new Date(cachedData.lastChecked).getTime()) > this.CACHE_DURATION;

      if (!shouldFetch) {
        return null; // No need to check yet
      }

      // Fetch current availability
      const currentAvailability = await tmdbService.getWatchProviders(item.id, item.type);
      const currentChecksum = this.generateChecksum(currentAvailability);

      // Compare with cached data
      if (cachedData && cachedData.checksum !== currentChecksum) {
        const change = this.detectAvailabilityChange(
          item,
          cachedData.availability,
          currentAvailability
        );

        // Update cache
        await this.updateAvailabilityCache(item.id, item.type, currentAvailability);

        return change;
      } else if (!cachedData) {
        // First time checking this item, just cache it
        await this.updateAvailabilityCache(item.id, item.type, currentAvailability);
      } else {
        // No changes, just update the last checked time
        await this.updateCacheTimestamp(item.id, item.type);
      }

      return null;
    } catch (error) {
      console.error(`Error checking availability for ${item.title}:`, error);
      return null;
    }
  }

  /**
   * Detect what type of availability change occurred
   */
  private detectAvailabilityChange(
    item: WatchlistItem,
    previousAvailability: StreamingOption[],
    currentAvailability: StreamingOption[]
  ): StreamingAvailabilityChange | null {
    const previousServices = new Set(previousAvailability.map(opt => opt.service.id));
    const currentServices = new Set(currentAvailability.map(opt => opt.service.id));

    // Check for newly added services
    const addedServices = Array.from(currentServices).filter(id => !previousServices.has(id));
    if (addedServices.length > 0) {
      const addedService = currentAvailability.find(opt => addedServices.includes(opt.service.id));
      if (addedService) {
        return {
          id: `${item.id}-${item.type}-${addedService.service.id}-added-${Date.now()}`,
          tmdbId: item.id,
          mediaType: item.type,
          title: item.title,
          changeType: 'added',
          service: {
            id: addedService.service.id,
            name: addedService.service.name,
          },
          previousAvailability,
          currentAvailability,
          detectedAt: new Date().toISOString(),
        };
      }
    }

    // Check for removed services
    const removedServices = Array.from(previousServices).filter(id => !currentServices.has(id));
    if (removedServices.length > 0) {
      const removedService = previousAvailability.find(opt => removedServices.includes(opt.service.id));
      if (removedService) {
        return {
          id: `${item.id}-${item.type}-${removedService.service.id}-removed-${Date.now()}`,
          tmdbId: item.id,
          mediaType: item.type,
          title: item.title,
          changeType: 'removed',
          service: {
            id: removedService.service.id,
            name: removedService.service.name,
          },
          previousAvailability,
          currentAvailability,
          detectedAt: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Get cached availability data for an item
   */
  private async getCachedAvailability(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<AvailabilityCache | null> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return null;

      const cache: AvailabilityCache[] = JSON.parse(cacheData);
      return cache.find(item => item.tmdbId === tmdbId && item.mediaType === mediaType) || null;
    } catch (error) {
      console.error('Error getting cached availability:', error);
      return null;
    }
  }

  /**
   * Update availability cache for an item
   */
  private async updateAvailabilityCache(
    tmdbId: number, 
    mediaType: 'movie' | 'tv', 
    availability: StreamingOption[]
  ): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      let cache: AvailabilityCache[] = cacheData ? JSON.parse(cacheData) : [];

      const existingIndex = cache.findIndex(item => 
        item.tmdbId === tmdbId && item.mediaType === mediaType
      );

      const newCacheItem: AvailabilityCache = {
        tmdbId,
        mediaType,
        availability,
        lastChecked: new Date().toISOString(),
        checksum: this.generateChecksum(availability),
      };

      if (existingIndex >= 0) {
        cache[existingIndex] = newCacheItem;
      } else {
        cache.push(newCacheItem);
      }

      // Keep cache size manageable (last 1000 items)
      if (cache.length > 1000) {
        cache = cache.slice(-1000);
      }

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error updating availability cache:', error);
    }
  }

  /**
   * Update only the timestamp for cached item (no availability change)
   */
  private async updateCacheTimestamp(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return;

      const cache: AvailabilityCache[] = JSON.parse(cacheData);
      const existingIndex = cache.findIndex(item => 
        item.tmdbId === tmdbId && item.mediaType === mediaType
      );

      if (existingIndex >= 0) {
        cache[existingIndex].lastChecked = new Date().toISOString();
        await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Error updating cache timestamp:', error);
    }
  }

  /**
   * Generate checksum for availability data to detect changes
   */
  private generateChecksum(availability: StreamingOption[]): string {
    const sortedServices = availability
      .map(opt => `${opt.service.id}-${opt.type}`)
      .sort()
      .join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sortedServices.length; i++) {
      const char = sortedServices.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Store availability changes for notification processing
   */
  private async storeAvailabilityChanges(changes: StreamingAvailabilityChange[]): Promise<void> {
    try {
      const existingChanges = await AsyncStorage.getItem('pending_availability_changes');
      const pendingChanges: StreamingAvailabilityChange[] = existingChanges ? JSON.parse(existingChanges) : [];
      
      pendingChanges.push(...changes);
      
      // Keep only recent changes (last 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentChanges = pendingChanges.filter(change => 
        new Date(change.detectedAt).getTime() > sevenDaysAgo
      );

      await AsyncStorage.setItem('pending_availability_changes', JSON.stringify(recentChanges));
    } catch (error) {
      console.error('Error storing availability changes:', error);
    }
  }

  /**
   * Get pending availability changes for notification processing
   */
  async getPendingChanges(): Promise<StreamingAvailabilityChange[]> {
    try {
      const changesData = await AsyncStorage.getItem('pending_availability_changes');
      return changesData ? JSON.parse(changesData) : [];
    } catch (error) {
      console.error('Error getting pending changes:', error);
      return [];
    }
  }

  /**
   * Clear processed availability changes
   */
  async clearProcessedChanges(changeIds: string[]): Promise<void> {
    try {
      const changesData = await AsyncStorage.getItem('pending_availability_changes');
      if (!changesData) return;

      const changes: StreamingAvailabilityChange[] = JSON.parse(changesData);
      const remainingChanges = changes.filter(change => !changeIds.includes(change.id));
      
      await AsyncStorage.setItem('pending_availability_changes', JSON.stringify(remainingChanges));
    } catch (error) {
      console.error('Error clearing processed changes:', error);
    }
  }

  /**
   * Filter changes based on user's subscribed services
   */
  async filterChangesByUserSubscriptions(
    changes: StreamingAvailabilityChange[]
  ): Promise<StreamingAvailabilityChange[]> {
    try {
      // Get user preferences to check subscribed services
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return [];

      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('subscribed_services')
        .eq('user_id', session.user.id)
        .single();

      if (!preferences?.subscribed_services) return [];

      const subscribedServices = new Set(preferences.subscribed_services);

      // Filter changes to only include subscribed services
      return changes.filter(change => {
        if (change.changeType === 'added') {
          // Only notify about content added to subscribed services
          return subscribedServices.has(change.service.id);
        } else if (change.changeType === 'removed' || change.changeType === 'leaving_soon') {
          // Notify about content leaving subscribed services
          return subscribedServices.has(change.service.id);
        }
        return false;
      });
    } catch (error) {
      console.error('Error filtering changes by subscriptions:', error);
      return [];
    }
  }

  /**
   * Force check availability for a specific item (useful for manual refresh)
   */
  async forceCheckItem(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StreamingAvailabilityChange | null> {
    try {
      const watchlist = await storageService.getWatchlist();
      const item = watchlist.find(w => w.id === tmdbId && w.type === mediaType);
      
      if (!item) {
        throw new Error('Item not found in watchlist');
      }

      // Clear cache for this item to force fresh check
      await this.clearItemCache(tmdbId, mediaType);
      
      return await this.checkItemAvailability(item);
    } catch (error) {
      console.error('Error force checking item:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific item
   */
  private async clearItemCache(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return;

      const cache: AvailabilityCache[] = JSON.parse(cacheData);
      const filteredCache = cache.filter(item => 
        !(item.tmdbId === tmdbId && item.mediaType === mediaType)
      );

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(filteredCache));
    } catch (error) {
      console.error('Error clearing item cache:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    totalItemsMonitored: number;
    lastCheckTime: string | null;
    pendingChanges: number;
    cacheSize: number;
  }> {
    try {
      const watchlist = await storageService.getWatchlist();
      const pendingChanges = await this.getPendingChanges();
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      const cache: AvailabilityCache[] = cacheData ? JSON.parse(cacheData) : [];

      const lastCheckTimes = cache.map(item => new Date(item.lastChecked).getTime());
      const lastCheckTime = lastCheckTimes.length > 0 
        ? new Date(Math.max(...lastCheckTimes)).toISOString()
        : null;

      return {
        totalItemsMonitored: watchlist.length,
        lastCheckTime,
        pendingChanges: pendingChanges.length,
        cacheSize: cache.length,
      };
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      return {
        totalItemsMonitored: 0,
        lastCheckTime: null,
        pendingChanges: 0,
        cacheSize: 0,
      };
    }
  }
}

export const streamingAvailabilityMonitor = new StreamingAvailabilityMonitorService();