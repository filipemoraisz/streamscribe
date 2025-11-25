import AsyncStorage from '@react-native-async-storage/async-storage';

export class DebugStorage {
  // View all registered users
  static async getAllUsers() {
    try {
      const usersData = await AsyncStorage.getItem('streamscribe_users');
      const users = usersData ? JSON.parse(usersData) : [];
      console.log('=== ALL REGISTERED USERS ===');
      users.forEach((user: any, index: number) => {
        console.log(`User ${index + 1}:`, {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          // Don't log password for security
        });
      });
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // View current logged-in user
  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('streamscribe_current_user');
      const user = userData ? JSON.parse(userData) : null;
      console.log('=== CURRENT USER ===');
      console.log(user);
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // View user's watchlist
  static async getUserWatchlist(userId?: string) {
    try {
      const currentUser = userId ? { id: userId } : await this.getCurrentUser();
      if (!currentUser) {
        console.log('No user logged in');
        return [];
      }

      const watchlistKey = `streamscribe_watchlist_${currentUser.id}`;
      const watchlistData = await AsyncStorage.getItem(watchlistKey);
      const watchlist = watchlistData ? JSON.parse(watchlistData) : [];
      
      console.log(`=== WATCHLIST FOR USER ${currentUser.id} ===`);
      watchlist.forEach((item: any, index: number) => {
        console.log(`Item ${index + 1}:`, {
          id: item.id,
          type: item.type,
          title: item.title,
          watched: item.watched,
          added_date: item.added_date,
        });
      });
      return watchlist;
    } catch (error) {
      console.error('Error getting watchlist:', error);
      return [];
    }
  }

  // View user's episode progress
  static async getUserEpisodeProgress(userId?: string) {
    try {
      const currentUser = userId ? { id: userId } : await this.getCurrentUser();
      if (!currentUser) {
        console.log('No user logged in');
        return [];
      }

      const progressKey = `streamscribe_episodes_progress_${currentUser.id}`;
      const progressData = await AsyncStorage.getItem(progressKey);
      const progress = progressData ? JSON.parse(progressData) : [];
      
      console.log(`=== EPISODE PROGRESS FOR USER ${currentUser.id} ===`);
      progress.forEach((item: any, index: number) => {
        console.log(`Episode ${index + 1}:`, {
          show_id: item.show_id,
          season: item.season_number,
          episode: item.episode_number,
          watched: item.watched,
          rating: item.rating,
          watched_date: item.watched_date,
        });
      });
      return progress;
    } catch (error) {
      console.error('Error getting episode progress:', error);
      return [];
    }
  }

  // View user's show progress
  static async getUserShowProgress(userId?: string) {
    try {
      const currentUser = userId ? { id: userId } : await this.getCurrentUser();
      if (!currentUser) {
        console.log('No user logged in');
        return [];
      }

      const progressKey = `streamscribe_shows_progress_${currentUser.id}`;
      const progressData = await AsyncStorage.getItem(progressKey);
      const progress = progressData ? JSON.parse(progressData) : [];
      
      console.log(`=== SHOW PROGRESS FOR USER ${currentUser.id} ===`);
      progress.forEach((item: any, index: number) => {
        console.log(`Show ${index + 1}:`, {
          show_id: item.show_id,
          current_season: item.current_season,
          current_episode: item.current_episode,
          total_watched_episodes: item.total_watched_episodes,
          status: item.status,
          last_watched_date: item.last_watched_date,
        });
      });
      return progress;
    } catch (error) {
      console.error('Error getting show progress:', error);
      return [];
    }
  }

  // View all storage keys (useful for debugging)
  static async getAllStorageKeys() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('=== ALL STORAGE KEYS ===');
      keys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
      });
      return keys;
    } catch (error) {
      console.error('Error getting storage keys:', error);
      return [];
    }
  }

  // Clear all user data (use with caution!)
  static async clearAllData() {
    try {
      await AsyncStorage.clear();
      console.log('All data cleared!');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }

  // Export all data as JSON
  static async exportAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data: { [key: string]: any } = {};
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        data[key] = value ? JSON.parse(value) : null;
      }
      
      console.log('=== EXPORTED DATA ===');
      console.log(JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      return {};
    }
  }
}

// Helper function to run all debug commands
export const debugAll = async () => {
  console.log('\n🔍 DEBUGGING STREAMSCRIBE STORAGE 🔍\n');
  
  await DebugStorage.getAllStorageKeys();
  console.log('\n');
  
  await DebugStorage.getAllUsers();
  console.log('\n');
  
  await DebugStorage.getCurrentUser();
  console.log('\n');
  
  await DebugStorage.getUserWatchlist();
  console.log('\n');
  
  await DebugStorage.getUserEpisodeProgress();
  console.log('\n');
  
  await DebugStorage.getUserShowProgress();
  console.log('\n');
};