import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { WatchlistItem } from '../types';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';

type WatchlistAction =
  | { type: 'ADD'; payload: Omit<WatchlistItem, 'added_date' | 'watched'> }
  | { type: 'REMOVE'; payload: { id: number; type: 'movie' | 'tv' } }
  | { type: 'TOGGLE_WATCHED'; payload: { id: number; type: 'movie' | 'tv' } }
  | { type: 'MARK_WATCHED'; payload: { id: number; type: 'movie' | 'tv' } };

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
            await supabase.from('watchlists').insert({
              user_id: userId,
              tmdb_id: item.id,
              media_type: item.type,
              status: 'plan_to_watch',
            });
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
            // We need to know the current status to toggle it on server, 
            // but for simplicity/robustness we might just want to set it explicitly.
            // However, the queue action doesn't have the new state.
            // Let's fetch the local item to see what the *intended* state is.
            // OR, better: The action payload should probably contain the target state.
            // For now, let's just re-fetch the item from Supabase and toggle it there? 
            // No, that defeats the purpose of offline sync if we need to read first.
            // Ideally 'TOGGLE' is risky in a queue. 'SET_STATUS' is better.
            // Given the current architecture, let's try to infer or just skip if complex.
            // Actually, let's look at how we use it. We toggle locally first.
            // So we can check our local state to see what we expect the server to be.

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
              .update({ status: 'completed' })
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
      // We already call syncPendingActions in constructor and after every action.
      // But let's make sure we don't overwrite local changes with old server data.
      // If queue is not empty, we should probably NOT pull from server yet, 
      // or be very careful.
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      const queue: WatchlistAction[] = queueJson ? JSON.parse(queueJson) : [];
      if (queue.length > 0) {
        // Try to clear queue first
        await this.syncPendingActions();
        // If queue still has items, abort sync to protect local changes
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
          // Fetch details for missing items
          const newItems: WatchlistItem[] = [];
          for (const item of missingItems) {
            try {
              let details;
              if (item.media_type === 'movie') {
                details = await tmdbService.getMovieDetails(item.tmdb_id);
              } else {
                details = await tmdbService.getTVShowDetails(item.tmdb_id);
              }

              if (details) {
                newItems.push({
                  id: item.tmdb_id,
                  type: item.media_type as 'movie' | 'tv',
                  title: item.media_type === 'movie' ? (details as any).title : (details as any).name,
                  poster_path: details.poster_path,
                  release_date: item.media_type === 'movie' ? (details as any).release_date : (details as any).first_air_date,
                  vote_average: details.vote_average,
                  added_date: item.created_at,
                  watched: item.status === 'completed',
                });
              }
            } catch (err) {
              console.error(`Error fetching details for ${item.media_type} ${item.tmdb_id}:`, err);
            }
          }

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

  async addToWatchlist(item: Omit<WatchlistItem, 'added_date' | 'watched'>): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const newItem: WatchlistItem = {
        ...item,
        added_date: new Date().toISOString(),
        watched: false,
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
            payload: item
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

  async markAsWatched(item: Omit<WatchlistItem, 'added_date' | 'watched'>): Promise<void> {
    try {
      // 1. Optimistic Update
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const existingItem = watchlist.find(w => w.id === item.id && w.type === item.type);

      if (existingItem) {
        if (!existingItem.watched) {
          existingItem.watched = true;
          await AsyncStorage.setItem(key, JSON.stringify(watchlist));

          const userId = await this.getUserId();
          if (userId) {
            await this.addToQueue({
              type: 'MARK_WATCHED',
              payload: { id: item.id, type: item.type }
            });
          }
        }
      } else {
        // Add new item as watched
        const newItem: WatchlistItem = {
          ...item,
          added_date: new Date().toISOString(),
          watched: true,
        };
        watchlist.push(newItem);
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        const userId = await this.getUserId();
        if (userId) {
          // This is complex: Insert AND Mark Watched. 
          // For simplicity, let's just insert as completed.
          // But our queue actions are separate.
          // Let's just do ADD first, then MARK_WATCHED?
          // Or just insert directly to Supabase if online?
          // No, stick to queue.
          // We can add a 'ADD_WATCHED' action type or just queue two actions.
          await this.addToQueue({
            type: 'ADD',
            payload: item
          });
          await this.addToQueue({
            type: 'MARK_WATCHED',
            payload: { id: item.id, type: item.type }
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
}

export const storageService = new StorageService();