// Add this to your app temporarily and run it once
// You can add it to a button or run it in the console

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

export async function clearProgressCache() {
  try {
    console.log('🧹 Clearing local progress cache...');
    
    // Get all keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('Total keys in storage:', allKeys.length);
    
    // Find progress-related keys
    const progressKeys = allKeys.filter(key => 
      key.includes('_episodes_progress_') || 
      key.includes('_shows_progress_') ||
      key === 'streamscribe_offline_queue'
    );
    
    console.log('Progress keys to clear:', progressKeys);
    
    // Remove them
    if (progressKeys.length > 0) {
      await AsyncStorage.multiRemove(progressKeys);
      console.log('✅ Cleared', progressKeys.length, 'cache keys');
    } else {
      console.log('ℹ️ No progress cache found');
    }
    
    // Now refresh from database
    console.log('🔄 Refreshing from database...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Fetch fresh data from database
      const { data: episodes } = await supabase
        .from('episode_progress')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('📊 Fresh data from database:', episodes?.length || 0, 'episodes');
      
      // Cache the fresh data
      if (episodes && episodes.length > 0) {
        const key = `streamscribe_episodes_progress_${user.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(episodes));
        console.log('✅ Cached fresh data');
      }
    }
    
    console.log('✨ Cache cleared! Restart your app or refresh the screen.');
    return true;
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return false;
  }
}

// Usage:
// import { clearProgressCache } from './clear_local_cache';
// await clearProgressCache();
