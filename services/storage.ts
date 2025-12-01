import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { WatchlistItem } from '../types';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';

type WatchlistAction =
  | { type: 'ADD'; payload: Omit<WatchlistItem, 'added_date'> }
  | { type: 'REMOVE'; payload: { id: number; type: 'movie' | 'tv' } }
  | { type: 'TOGGLE_WATCHED'; payload: { id: number; type: 'movie' | 'tv' } }
  | { type: 'MARK_WATCHED'; payload: { id: number; type: 'movie' | 'tv' } }
  | { type: 'UPDATE_REWATCH'; payload: { id: number; type: 'movie' | 'tv'; count: number } };

class StorageService {
  private readonly QUEUE_KEY = 'streamscribe_watchlist_queue';

  constructor() {
    // Attempt to sync on startup
    this.syncPendingActions();
  }

  private async getUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }

  private async getWatchlistKey(): Promise<string> {
    const userId = await this.getUserId();
    return userId ? `streamscribe_watchlist_${userId}` : 'streamscribe_watchlist_guest';
  }

  // --- Offline Queue Management ---

  private async addToQueue(action: WatchlistAction): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      const queue: WatchlistAction[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push(action);
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));

      // Try to sync immediately
      this.syncPendingActions();
    } catch (error) {
      console.error('Error adding to watchlist queue:', error);
    }
  }

  async syncPendingActions(): Promise<void> {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    try {
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (!queueJson) return;

      const queue: WatchlistAction[] = JSON.parse(queueJson);
      if (queue.length === 0) return;

      const userId = await this.getUserId();
      if (!userId) return;

      const remainingQueue: WatchlistAction[] = [];

      for (const action of queue) {
        try {
          if (action.type === 'ADD') {
            const item = action.payload;
            await supabase.from('watchlists').upsert({
              user_id: userId,
              tmdb_id: item.id,
              media_type: item.type,
              status: item.watched ? 'completed' : 'plan_to_watch',
              rewatch_count: item.rewatch_count || 0
            }, { onConflict: 'user_id, tmdb_id, media_type' });
          } else if (action.type === 'REMOVE') {
            const { id, type } = action.payload;
            await supabase
              .from('watchlists')
              .delete()
              .eq('user_id', userId)
              .eq('tmdb_id', id)
              .eq('media_type', type);
          } else if (action.type === 'TOGGLE_WATCHED') {
            const { id, type } = action.payload;
            const key = await this.getWatchlistKey();
            const localData = await AsyncStorage.getItem(key);
            const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];
            const item = watchlist.find(w => w.id === id && w.type === type);

            if (item) {
              await supabase
                .from('watchlists')
                .update({ status: item.watched ? 'completed' : 'plan_to_watch' })
                .eq('user_id', userId)
                .eq('tmdb_id', id)
                .eq('media_type', type);
            }

          } else if (action.type === 'MARK_WATCHED') {
            const { id, type } = action.payload;
            await supabase
              .from('watchlists')
              .update({ status: 'completed', rewatch_count: 0 })
              .eq('user_id', userId)
              .eq('tmdb_id', id)
              .eq('media_type', type);
          } else if (action.type === 'UPDATE_REWATCH') {
            const { id, type, count } = action.payload;
            await supabase
              .from('watchlists')
              .update({ rewatch_count: count })
              .eq('user_id', userId)
              .eq('tmdb_id', id)
              .eq('media_type', type);
          }
        } catch (err) {
          console.error('Failed to sync watchlist action:', action, err);
          remainingQueue.push(action);
        }
      }

      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remainingQueue));

      // Sync full list after processing queue to ensure consistency
      if (remainingQueue.length === 0) {
        await this.syncWatchlist();
      }

    } catch (error) {
      console.error('Error syncing pending watchlist actions:', error);
    }
  }

  // --- Public Methods ---

  async getWatchlist(): Promise<WatchlistItem[]> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const localWatchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      // Trigger background sync if user is logged in
      this.syncWatchlist().catch(err => console.error('Background sync failed:', err));

      return localWatchlist;
    } catch (error) {
      console.error('Error getting watchlist:', error);
      return [];
    }
  }

  async syncWatchlist(): Promise<void> {
    try {
      const userId = await this.getUserId();
      if (!userId) return;

      // Process queue first!
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      const queue: WatchlistAction[] = queueJson ? JSON.parse(queueJson) : [];
      if (queue.length > 0) {
        await this.syncPendingActions();
        const remainingQueueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
        const remainingQueue = remainingQueueJson ? JSON.parse(remainingQueueJson) : [];
        if (remainingQueue.length > 0) return;
      }

      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      let localWatchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      // Fetch from Supabase
      const { data: cloudWatchlist, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', userId);

      if (!error && cloudWatchlist) {
        const localIds = new Set(localWatchlist.map(i => `${i.type}-${i.id}`));
        const missingItems = cloudWatchlist.filter(c => !localIds.has(`${c.media_type}-${c.tmdb_id}`));

        if (missingItems.length > 0) {
          // OPTIMIZED: Batch fetch details for missing items using Promise.all
          const newItems: WatchlistItem[] = [];
          
          const fetchPromises = missingItems.map(async (item) => {
            try {
              let details;
              if (item.media_type === 'movie') {
                details = await tmdbService.getMovieDetails(item.tmdb_id);
              } else {
                details = await tmdbService.getTVShowDetails(item.tmdb_id);
              }

              if (details) {
                return {
                  id: item.tmdb_id,
                  type: item.media_type as 'movie' | 'tv',
                  title: item.media_type === 'movie' ? (details as any).title : (details as any).name,
                  poster_path: details.poster_path,
                  release_date: item.media_type === 'movie' ? (details as any).release_date : (details as any).first_air_date,
                  vote_average: details.vote_average,
                  added_date: item.created_at,
                  watched: item.status === 'completed',
                  rewatch_count: item.rewatch_count || 0,
                };
              }
            } catch (err) {
              console.error(`Error fetching details for ${item.media_type} ${item.tmdb_id}:`, err);
            }
            return null;
          });

          const results = await Promise.all(fetchPromises);
          newItems.push(...results.filter((item): item is WatchlistItem => item !== null));

          if (newItems.length > 0) {
            localWatchlist = [...localWatchlist, ...newItems];
            await AsyncStorage.setItem(key, JSON.stringify(localWatchlist));
          }
        }
      }
    } catch (error) {
      console.error('Error syncing watchlist:', error);
    }
  }

  async addToWatchlist(item: Omit<WatchlistItem, 'added_date'>): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const newItem: WatchlistItem = {
        ...item,
        added_date: new Date().toISOString(),
        watched: item.watched ?? false,
        rewatch_count: item.rewatch_count ?? 0,
      };

      const exists = watchlist.some(w => w.id === item.id && w.type === item.type);
      if (!exists) {
        watchlist.push(newItem);
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // 2. Queue for Sync
        const userId = await this.getUserId();
        if (userId) {
          await this.addToQueue({
            type: 'ADD',
            payload: newItem
          });
        }
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }

  async removeFromWatchlist(id: number, type: 'movie' | 'tv'): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const filtered = watchlist.filter(item => !(item.id === id && item.type === type));
      await AsyncStorage.setItem(key, JSON.stringify(filtered));

      // 2. Queue for Sync
      const userId = await this.getUserId();
      if (userId) {
        await this.addToQueue({
          type: 'REMOVE',
          payload: { id, type }
        });
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  }

  async updateWatchlistStatus(id: number, type: 'movie' | 'tv', status: 'plan_to_watch' | 'watching' | 'completed'): Promise<void> {
    try {
      const userId = await this.getUserId();
      if (!userId) return;

      // Update directly in Supabase
      const { error } = await supabase
        .from('watchlists')
        .update({ status })
        .eq('user_id', userId)
        .eq('tmdb_id', id)
        .eq('media_type', type);

      if (error) throw error;
      
      console.log(`[Storage] Updated watchlist status for ${type} ${id} to ${status}`);
    } catch (error) {
      console.error('Error updating watchlist status:', error);
      throw error;
    }
  }

  async toggleWatched(id: number, type: 'movie' | 'tv'): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const item = watchlist.find(w => w.id === id && w.type === type);

      if (item) {
        item.watched = !item.watched;
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // 2. Queue for Sync
        const userId = await this.getUserId();
        if (userId) {
          await this.addToQueue({
            type: 'TOGGLE_WATCHED',
            payload: { id, type }
          });
        }
      }
    } catch (error) {
      console.error('Error toggling watched status:', error);
    }
  }

  async isInWatchlist(id: number, type: 'movie' | 'tv'): Promise<boolean> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];
      return watchlist.some(item => item.id === id && item.type === type);
    } catch (error) {
      console.error('Error checking watchlist:', error);
      return false;
    }
  }

  async getWatchlistIds(userId?: string): Promise<Set<string>> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const ids = new Set<string>();
      watchlist.forEach(item => {
        ids.add(`${item.type}-${item.id}`);
      });
      return ids;
    } catch (error) {
      console.error('Error getting watchlist IDs:', error);
      return new Set();
    }
  }

  async markAsWatched(item: Omit<WatchlistItem, 'added_date'>): Promise<void> {
    if (item.type === 'tv') {
      console.warn('markAsWatched is not supported for TV shows in storageService. Use progressService instead.');
      return;
    }

    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const existingItemIndex = watchlist.findIndex(w => w.id === item.id && w.type === item.type);

      if (existingItemIndex !== -1) {
        // Update existing
        watchlist[existingItemIndex] = {
          ...watchlist[existingItemIndex],
          watched: true,
          rewatch_count: watchlist[existingItemIndex].rewatch_count ?? 0
        };
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // Queue update
        const userId = await this.getUserId();
        if (userId) {
          await this.addToQueue({
            type: 'MARK_WATCHED',
            payload: { id: item.id, type: item.type }
          });
        }
      } else {
        // Add new item as watched
        const newItem: WatchlistItem = {
          ...item,
          added_date: new Date().toISOString(),
          watched: true,
          rewatch_count: 0
        };
        watchlist.push(newItem);
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // Queue add
        const userId = await this.getUserId();
        if (userId) {
          await this.addToQueue({
            type: 'ADD',
            payload: newItem
          });
        }
      }

    } catch (error) {
      console.error('Error marking as watched:', error);
    }
  }

  async updateWatchlistItem(updatedItem: WatchlistItem): Promise<void> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const index = watchlist.findIndex(item => item.id === updatedItem.id && item.type === updatedItem.type);

      if (index !== -1) {
        watchlist[index] = updatedItem;
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));
      }
    } catch (error) {
      console.error('Error updating watchlist item:', error);
    }
  }

  async incrementRewatch(id: number, type: 'movie' | 'tv'): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const item = watchlist.find(w => w.id === id && w.type === type);
      if (item) {
        const newCount = (item.rewatch_count || 0) + 1;
        item.rewatch_count = newCount;
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // 2. Queue for Sync
        const userId = await this.getUserId();
        if (userId) {
          await this.addToQueue({
            type: 'UPDATE_REWATCH',
            payload: { id, type, count: newCount }
          });
        }
      }
    } catch (error) {
      console.error('Error incrementing rewatch count:', error);
    }
  }
}

export const storageService = new StorageService();