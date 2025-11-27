import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchlistItem } from '../types';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';

class StorageService {
  private async getUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }

  private async getWatchlistKey(): Promise<string> {
    const userId = await this.getUserId();
    return userId ? `streamscribe_watchlist_${userId}` : 'streamscribe_watchlist_guest';
  }

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
      // Get current list directly from storage to avoid circular sync calls
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

        // Sync to Supabase if logged in
        const userId = await this.getUserId();
        if (userId) {
          await supabase.from('watchlists').insert({
            user_id: userId,
            tmdb_id: item.id,
            media_type: item.type,
            status: 'plan_to_watch',
          });
        }
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }

  async removeFromWatchlist(id: number, type: 'movie' | 'tv'): Promise<void> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const filtered = watchlist.filter(item => !(item.id === id && item.type === type));
      await AsyncStorage.setItem(key, JSON.stringify(filtered));

      // Sync to Supabase if logged in
      const userId = await this.getUserId();
      if (userId) {
        await supabase
          .from('watchlists')
          .delete()
          .eq('user_id', userId)
          .eq('tmdb_id', id)
          .eq('media_type', type);
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  }

  async toggleWatched(id: number, type: 'movie' | 'tv'): Promise<void> {
    try {
      const key = await this.getWatchlistKey();
      const localData = await AsyncStorage.getItem(key);
      const watchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

      const item = watchlist.find(w => w.id === id && w.type === type);

      if (item) {
        item.watched = !item.watched;
        await AsyncStorage.setItem(key, JSON.stringify(watchlist));

        // Sync to Supabase if logged in
        const userId = await this.getUserId();
        if (userId) {
          await supabase
            .from('watchlists')
            .update({ status: item.watched ? 'completed' : 'plan_to_watch' })
            .eq('user_id', userId)
            .eq('tmdb_id', id)
            .eq('media_type', type);
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
            await supabase
              .from('watchlists')
              .update({ status: 'completed' })
              .eq('user_id', userId)
              .eq('tmdb_id', item.id)
              .eq('media_type', item.type);
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
          await supabase.from('watchlists').insert({
            user_id: userId,
            tmdb_id: item.id,
            media_type: item.type,
            status: 'completed',
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