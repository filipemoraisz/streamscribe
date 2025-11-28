import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { episodeTracker } from './episodeTracker';
import { notificationManager } from './notifications';
import { realTimeManager } from './realtime';
import { performanceOptimizer } from './performanceOptimizer';
import { backgroundTaskManager } from './backgroundTaskManager';
import { SyncAction, SyncResult, QueueStatus } from '../types';

// Conditional imports for Expo modules
let BackgroundFetch: any = null;
let TaskManager: any = null;
let Battery: any = null;

try {
  BackgroundFetch = require('expo-background-fetch');
} catch (error) {
  console.warn('[BackgroundSync] expo-background-fetch not available');
}

try {
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.warn('[BackgroundSync] expo-task-manager not available');
}

try {
  Battery = require('expo-battery');
} catch (error) {
  console.warn('[BackgroundSync] expo-battery not available');
}

// Background task identifiers
const BACKGROUND_EPISODE_CHECK = 'background-episode-check';
const BACKGROUND_SYNC_QUEUE = 'background-sync-queue';
const BACKGROUND_GENERAL_SYNC = 'background-general-sync';

// Intervals
const EPISODE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SYNC_QUEUE_INTERVAL = 15 * 60 * 1000; // 15 minutes
const GENERAL_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

interface BackgroundSyncResult {
  success: boolean;
  newEpisodes: number;
  syncedActions?: number;
  error?: string;
  timestamp: string;
}

interface BackgroundTaskConfig {
  taskName: string;
  interval: number;
  handler: () => Promise<BackgroundSyncResult>;
  priority: 'high' | 'normal' | 'low';
}

interface PerformanceMetrics {
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  networkType?: string;
  lastSyncDuration?: number;
  avgSyncDuration?: number;
  syncCount: number;
}

export class BackgroundSyncService {
  private isRegistered = false;
  private lastSyncTime?: string;
  private registeredTasks: Map<string, BackgroundTaskConfig> = new Map();
  private isProcessing = false;
  private performanceMetrics: PerformanceMetrics = { syncCount: 0 };
  private syncQueue: SyncAction[] = [];
  private maxQueueSize = 100;
  private batchSize = 10;

  /**
   * Initialize background sync service
   */
  async initialize(): Promise<void> {
    try {
      console.log('[BackgroundSync] Initializing background sync service');
      
      // Check if required modules are available
      if (!BackgroundFetch || !TaskManager) {
        console.warn('[BackgroundSync] Required Expo modules not available, background sync disabled');
        return;
      }
      
      // Load sync queue from storage
      await this.loadSyncQueue();
      
      // Initialize performance metrics
      await this.initializePerformanceMetrics();
      
      // Initialize performance optimizer
      await performanceOptimizer.initialize();
      
      // Initialize background task manager
      await backgroundTaskManager.initialize();
      
      // Register all background tasks
      await this.registerBackgroundTasks();
      
      // Set up background fetch for all tasks
      await this.setupBackgroundFetch();
      
      console.log('[BackgroundSync] Background sync service initialized');
    } catch (error) {
      console.error('[BackgroundSync] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('background_sync_queue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
        console.log(`[BackgroundSync] Loaded ${this.syncQueue.length} queued actions`);
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('background_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[BackgroundSync] Failed to save sync queue:', error);
    }
  }

  /**
   * Initialize performance metrics
   */
  private async initializePerformanceMetrics(): Promise<void> {
    try {
      const metricsData = await AsyncStorage.getItem('background_sync_metrics');
      if (metricsData) {
        this.performanceMetrics = { ...this.performanceMetrics, ...JSON.parse(metricsData) };
      }
      
      // Update current battery and network info
      await this.updatePerformanceMetrics();
    } catch (error) {
      console.error('[BackgroundSync] Failed to initialize performance metrics:', error);
    }
  }

  /**
   * Update performance metrics with current device state
   */
  private async updatePerformanceMetrics(): Promise<void> {
    try {
      if (Battery) {
        this.performanceMetrics.batteryLevel = await Battery.getBatteryLevelAsync();
        this.performanceMetrics.isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
      }
    } catch (error) {
      console.warn('[BackgroundSync] Failed to update performance metrics:', error);
    }
  }

  /**
   * Register all background tasks
   */
  private async registerBackgroundTasks(): Promise<void> {
    // Register tasks with the background task manager
    await backgroundTaskManager.registerTask({
      name: BACKGROUND_EPISODE_CHECK,
      priority: 'normal',
      handler: () => this.wrapTaskHandler(() => this.executeEpisodeCheck()),
      interval: EPISODE_CHECK_INTERVAL,
      maxRetries: 3,
      timeout: 60000, // 1 minute timeout
      enabled: true,
      fallbackHandler: () => this.wrapTaskHandler(() => this.executeEpisodeCheckFallback()),
    });

    await backgroundTaskManager.registerTask({
      name: BACKGROUND_SYNC_QUEUE,
      priority: 'high',
      handler: () => this.wrapTaskHandler(() => this.executeSyncQueueProcessing()),
      interval: SYNC_QUEUE_INTERVAL,
      maxRetries: 5,
      timeout: 30000, // 30 seconds timeout
      enabled: true,
      fallbackHandler: () => this.wrapTaskHandler(() => this.executeSyncQueueFallback()),
    });

    await backgroundTaskManager.registerTask({
      name: BACKGROUND_GENERAL_SYNC,
      priority: 'normal',
      handler: () => this.wrapTaskHandler(() => this.executeGeneralSync()),
      interval: GENERAL_SYNC_INTERVAL,
      maxRetries: 3,
      timeout: 45000, // 45 seconds timeout
      enabled: true,
      dependencies: [BACKGROUND_SYNC_QUEUE], // Depends on sync queue being processed first
    });

    // Also register with legacy TaskManager for compatibility
    await this.registerBackgroundTask();
  }

  /**
   * Register a background task configuration
   */
  registerTask(config: BackgroundTaskConfig): void {
    console.log(`[BackgroundSync] Registering task: ${config.taskName}`);
    this.registeredTasks.set(config.taskName, config);
  }

  /**
   * Register the background tasks with TaskManager
   */
  private async registerBackgroundTask(): Promise<void> {
    if (this.isRegistered) {
      console.log('[BackgroundSync] Tasks already registered');
      return;
    }

    if (!TaskManager || !BackgroundFetch) {
      console.warn('[BackgroundSync] TaskManager or BackgroundFetch not available');
      return;
    }

    try {
      // Define episode check task
      TaskManager.defineTask(BACKGROUND_EPISODE_CHECK, async () => {
        return await this.executeTaskWithMetrics(BACKGROUND_EPISODE_CHECK);
      });

      // Define sync queue processing task
      TaskManager.defineTask(BACKGROUND_SYNC_QUEUE, async () => {
        return await this.executeTaskWithMetrics(BACKGROUND_SYNC_QUEUE);
      });

      // Define general sync task
      TaskManager.defineTask(BACKGROUND_GENERAL_SYNC, async () => {
        return await this.executeTaskWithMetrics(BACKGROUND_GENERAL_SYNC);
      });

      this.isRegistered = true;
      console.log('[BackgroundSync] All background tasks registered');
    } catch (error) {
      console.error('[BackgroundSync] Failed to register background tasks:', error);
      throw error;
    }
  }

  /**
   * Execute a task with performance metrics tracking
   */
  private async executeTaskWithMetrics(taskName: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log(`[BackgroundSync] Executing ${taskName}`);
      
      // Check if we should throttle this task
      if (await this.shouldThrottleTask(taskName)) {
        console.log(`[BackgroundSync] Throttling ${taskName} due to performance constraints`);
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      
      // Check if background processing should be paused entirely
      if (performanceOptimizer.shouldPauseBackgroundProcessing()) {
        console.log(`[BackgroundSync] Pausing ${taskName} due to critical performance constraints`);
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      
      const taskConfig = this.registeredTasks.get(taskName);
      if (!taskConfig) {
        console.error(`[BackgroundSync] Task configuration not found: ${taskName}`);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
      
      const result = await taskConfig.handler();
      const duration = Date.now() - startTime;
      
      // Update performance metrics
      await this.updateTaskMetrics(taskName, duration, result.success);
      
      // Store result for debugging
      await AsyncStorage.setItem(`last_${taskName}`, JSON.stringify({
        ...result,
        duration
      }));
      
      if (result.success) {
        console.log(`[BackgroundSync] ${taskName} completed successfully in ${duration}ms`);
        return result.newEpisodes > 0 || (result.syncedActions && result.syncedActions > 0)
          ? BackgroundFetch.BackgroundFetchResult.NewData 
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } else {
        console.error(`[BackgroundSync] ${taskName} failed:`, result.error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[BackgroundSync] ${taskName} error after ${duration}ms:`, error);
      await this.updateTaskMetrics(taskName, duration, false);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  }

  /**
   * Update task performance metrics
   */
  private async updateTaskMetrics(taskName: string, duration: number, success: boolean): Promise<void> {
    try {
      this.performanceMetrics.syncCount++;
      this.performanceMetrics.lastSyncDuration = duration;
      
      // Calculate average duration
      if (this.performanceMetrics.avgSyncDuration) {
        this.performanceMetrics.avgSyncDuration = 
          (this.performanceMetrics.avgSyncDuration + duration) / 2;
      } else {
        this.performanceMetrics.avgSyncDuration = duration;
      }
      
      // Update battery and performance info
      await this.updatePerformanceMetrics();
      
      // Save metrics
      await AsyncStorage.setItem('background_sync_metrics', JSON.stringify(this.performanceMetrics));
    } catch (error) {
      console.error('[BackgroundSync] Failed to update task metrics:', error);
    }
  }

  /**
   * Set up background fetch configuration
   */
  private async setupBackgroundFetch(): Promise<void> {
    if (!BackgroundFetch) {
      console.warn('[BackgroundSync] BackgroundFetch not available');
      return;
    }

    try {
      // Check if background fetch is available
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn('[BackgroundSync] Background fetch is restricted');
        return;
      }

      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn('[BackgroundSync] Background fetch is denied');
        return;
      }

      // Register all background tasks
      for (const [taskName, config] of this.registeredTasks) {
        await BackgroundFetch.registerTaskAsync(taskName, {
          minimumInterval: await this.getAdaptiveInterval(config),
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log(`[BackgroundSync] Registered ${taskName} with interval ${config.interval}ms`);
      }

      console.log('[BackgroundSync] All background fetch tasks registered');
    } catch (error) {
      console.error('[BackgroundSync] Failed to setup background fetch:', error);
      throw error;
    }
  }

  /**
   * Get adaptive interval based on performance metrics and battery state
   */
  private async getAdaptiveInterval(config: BackgroundTaskConfig): Promise<number> {
    // Use performance optimizer for adaptive intervals
    return performanceOptimizer.getAdaptiveSyncFrequency(config.priority);
  }

  /**
   * Wrap task handler to convert BackgroundSyncResult to TaskResult
   */
  private async wrapTaskHandler(handler: () => Promise<BackgroundSyncResult>): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await handler();
      const duration = Date.now() - startTime;
      
      return {
        success: result.success,
        data: result,
        duration,
        timestamp: result.timestamp,
        error: result.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        data: null,
        duration,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute episode checking task
   */
  private async executeEpisodeCheck(): Promise<BackgroundSyncResult> {
    return await this.executeBackgroundSync();
  }

  /**
   * Execute sync queue processing task
   */
  private async executeSyncQueueProcessing(): Promise<BackgroundSyncResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[BackgroundSync] Processing sync queue in background');
      
      if (this.syncQueue.length === 0) {
        return {
          success: true,
          newEpisodes: 0,
          syncedActions: 0,
          timestamp,
        };
      }
      
      // Process queue in batches to avoid overwhelming the system
      const result = await this.processSyncQueueBatch();
      
      return {
        success: result.processed > 0 || result.failed === 0,
        newEpisodes: 0,
        syncedActions: result.processed,
        timestamp,
      };
    } catch (error) {
      console.error('[BackgroundSync] Sync queue processing error:', error);
      return {
        success: false,
        newEpisodes: 0,
        syncedActions: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };
    }
  }

  /**
   * Execute episode check fallback (simplified version)
   */
  private async executeEpisodeCheckFallback(): Promise<BackgroundSyncResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[BackgroundSync] Executing episode check fallback');
      
      // Simple fallback - just check if user is authenticated and log
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: true,
          newEpisodes: 0,
          timestamp,
        };
      }
      
      // Minimal episode check without notifications
      // This is a fallback so we don't want to overwhelm the system
      console.log('[BackgroundSync] Episode check fallback completed (minimal check)');
      
      return {
        success: true,
        newEpisodes: 0, // Don't report episodes in fallback to avoid duplicate notifications
        timestamp,
      };
    } catch (error) {
      console.error('[BackgroundSync] Episode check fallback error:', error);
      return {
        success: false,
        newEpisodes: 0,
        error: error instanceof Error ? error.message : 'Fallback error',
        timestamp,
      };
    }
  }

  /**
   * Execute sync queue processing fallback (reduced batch size)
   */
  private async executeSyncQueueFallback(): Promise<BackgroundSyncResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[BackgroundSync] Executing sync queue fallback with reduced batch size');
      
      if (this.syncQueue.length === 0) {
        return {
          success: true,
          newEpisodes: 0,
          syncedActions: 0,
          timestamp,
        };
      }
      
      // Process only 1-2 items in fallback mode
      const fallbackBatchSize = Math.min(2, this.syncQueue.length);
      const batch = this.syncQueue.splice(0, fallbackBatchSize);
      
      let processed = 0;
      for (const action of batch) {
        try {
          await this.processAction(action);
          processed++;
        } catch (error) {
          console.error(`[BackgroundSync] Fallback processing failed for action ${action.id}:`, error);
          // Re-queue the action for later
          this.syncQueue.push(action);
        }
      }
      
      await this.saveSyncQueue();
      
      return {
        success: processed > 0,
        newEpisodes: 0,
        syncedActions: processed,
        timestamp,
      };
    } catch (error) {
      console.error('[BackgroundSync] Sync queue fallback error:', error);
      return {
        success: false,
        newEpisodes: 0,
        syncedActions: 0,
        error: error instanceof Error ? error.message : 'Fallback error',
        timestamp,
      };
    }
  }

  /**
   * Execute general sync task (real-time manager sync)
   */
  private async executeGeneralSync(): Promise<BackgroundSyncResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[BackgroundSync] Executing general background sync');
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: true,
          newEpisodes: 0,
          syncedActions: 0,
          timestamp,
        };
      }
      
      // Trigger real-time manager sync if available
      if (realTimeManager && typeof realTimeManager.processSyncQueue === 'function') {
        await realTimeManager.processSyncQueue();
      }
      
      return {
        success: true,
        newEpisodes: 0,
        syncedActions: 0, // Real-time manager doesn't report count
        timestamp,
      };
    } catch (error) {
      console.error('[BackgroundSync] General sync error:', error);
      return {
        success: false,
        newEpisodes: 0,
        syncedActions: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };
    }
  }

  /**
   * Execute background sync - check for new episodes (legacy method)
   */
  async executeBackgroundSync(): Promise<BackgroundSyncResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[BackgroundSync] Starting background episode check');
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[BackgroundSync] No authenticated user, skipping sync');
        return {
          success: true,
          newEpisodes: 0,
          timestamp,
        };
      }

      // Check for new episodes using the episode tracker
      // Note: Episode notifications are now handled automatically by the episode tracker
      const newEpisodes = await episodeTracker.checkForNewEpisodes();
      
      if (newEpisodes.length > 0) {
        console.log(`[BackgroundSync] Found ${newEpisodes.length} new episodes (notifications handled by episode tracker)`);
      }

      this.lastSyncTime = timestamp;
      
      return {
        success: true,
        newEpisodes: newEpisodes.length,
        timestamp,
      };
      
    } catch (error) {
      console.error('[BackgroundSync] Background sync error:', error);
      return {
        success: false,
        newEpisodes: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };
    }
  }

  /**
   * Group episodes by show for better notification organization
   */
  private groupEpisodesByShow(episodes: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    episodes.forEach(episode => {
      const showName = episode.showName;
      if (!grouped.has(showName)) {
        grouped.set(showName, []);
      }
      grouped.get(showName)!.push(episode);
    });
    
    return grouped;
  }

  /**
   * Send notification for new episodes of a show
   */
  private async sendEpisodeNotification(showName: string, episodes: any[]): Promise<void> {
    try {
      // Sort episodes by season and episode number
      const sortedEpisodes = episodes.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) {
          return a.seasonNumber - b.seasonNumber;
        }
        return a.episodeNumber - b.episodeNumber;
      });

      const firstEpisode = sortedEpisodes[0];
      let title: string;
      let body: string;

      if (episodes.length === 1) {
        title = `New Episode: ${showName}`;
        body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`;
      } else {
        title = `${episodes.length} New Episodes: ${showName}`;
        const lastEpisode = sortedEpisodes[sortedEpisodes.length - 1];
        body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} - S${lastEpisode.seasonNumber}E${lastEpisode.episodeNumber}`;
      }

      // Schedule local notification
      await notificationManager.scheduleLocalNotification({
        id: `episode_${firstEpisode.showId}_${Date.now()}`,
        title,
        body,
        data: {
          type: 'episode_release',
          showId: firstEpisode.showId,
          showName,
          episodes: episodes.map(ep => ({
            season: ep.seasonNumber,
            episode: ep.episodeNumber,
            name: ep.episodeName,
            airDate: ep.airDate,
          })),
        },
      });

      console.log(`[BackgroundSync] Notification sent for ${showName}`);
    } catch (error) {
      console.error(`[BackgroundSync] Failed to send notification for ${showName}:`, error);
    }
  }

  /**
   * Process sync queue in batches
   */
  private async processSyncQueueBatch(): Promise<SyncResult> {
    const optimalBatchSize = performanceOptimizer.getOptimalBatchSize(this.batchSize);
    const batchSize = this.shouldThrottleSync() ? Math.floor(optimalBatchSize / 2) : optimalBatchSize;
    const batch = this.syncQueue.splice(0, batchSize);
    
    let processed = 0;
    let failed = 0;
    const conflicts: any[] = [];
    
    for (const action of batch) {
      try {
        await this.processAction(action);
        processed++;
      } catch (error) {
        console.error(`[BackgroundSync] Failed to process action ${action.id}:`, error);
        failed++;
        
        // Retry logic
        action.retryCount = (action.retryCount || 0) + 1;
        if (action.retryCount < 3) {
          this.syncQueue.push(action); // Re-queue for retry
        }
      }
    }
    
    // Save updated queue
    await this.saveSyncQueue();
    
    return { processed, failed, conflicts };
  }

  /**
   * Process a single sync action
   */
  private async processAction(action: SyncAction): Promise<void> {
    console.log(`[BackgroundSync] Processing action: ${action.type}`, action.payload);
    
    switch (action.type) {
      case 'progress_update':
        await this.processProgressUpdate(action);
        break;
      case 'watchlist_change':
        await this.processWatchlistChange(action);
        break;
      case 'preference_update':
        await this.processPreferenceUpdate(action);
        break;
      default:
        console.warn(`[BackgroundSync] Unknown action type: ${action.type}`);
    }
  }

  /**
   * Process progress update action
   */
  private async processProgressUpdate(action: SyncAction): Promise<void> {
    const { showId, seasonNumber, episodeNumber, watched, userId } = action.payload;
    
    // Update episode progress in database
    const { error } = await supabase
      .from('episode_progress')
      .upsert({
        user_id: userId,
        show_id: showId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        watched,
        watched_date: watched ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      throw new Error(`Failed to update episode progress: ${error.message}`);
    }
  }

  /**
   * Process watchlist change action
   */
  private async processWatchlistChange(action: SyncAction): Promise<void> {
    const { itemId, userId, operation } = action.payload;
    
    switch (operation) {
      case 'add':
        const { error: addError } = await supabase
          .from('watchlist')
          .insert({
            user_id: userId,
            item_id: itemId,
            added_date: new Date().toISOString(),
          });
        
        if (addError) {
          throw new Error(`Failed to add to watchlist: ${addError.message}`);
        }
        break;
        
      case 'remove':
        const { error: removeError } = await supabase
          .from('watchlist')
          .delete()
          .match({ user_id: userId, item_id: itemId });
        
        if (removeError) {
          throw new Error(`Failed to remove from watchlist: ${removeError.message}`);
        }
        break;
    }
  }

  /**
   * Process preference update action
   */
  private async processPreferenceUpdate(action: SyncAction): Promise<void> {
    const { userId, preferences } = action.payload;
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }
  }

  /**
   * Add action to background sync queue
   */
  addToSyncQueue(action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount' | 'deviceId'>): void {
    const syncAction: SyncAction = {
      id: `bg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      deviceId: 'background_service',
      ...action,
    };
    
    this.syncQueue.push(syncAction);
    
    // Trim queue if it gets too large
    if (this.syncQueue.length > this.maxQueueSize) {
      this.syncQueue = this.syncQueue.slice(-this.maxQueueSize);
      console.warn('[BackgroundSync] Sync queue trimmed to prevent memory issues');
    }
    
    this.saveSyncQueue();
  }

  /**
   * Get sync queue status
   */
  getSyncQueueStatus(): QueueStatus {
    return {
      pendingActions: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime || '',
      isProcessing: this.isProcessing,
      errors: [], // Could be enhanced to track errors
    };
  }

  /**
   * Manually trigger episode check (for testing or immediate sync)
   */
  async triggerEpisodeCheck(): Promise<BackgroundSyncResult> {
    console.log('[BackgroundSync] Manually triggering episode check');
    return await this.executeBackgroundSync();
  }

  /**
   * Get the status of background sync
   */
  async getBackgroundSyncStatus(): Promise<{
    isRegistered: boolean;
    lastSyncTime?: string;
    backgroundFetchStatus: string;
    lastSyncResult?: BackgroundSyncResult;
  }> {
    try {
      let backgroundFetchStatus = 'unavailable';
      
      if (BackgroundFetch) {
        const status = await BackgroundFetch.getStatusAsync();
        backgroundFetchStatus = this.getBackgroundFetchStatusString(status);
      }
      
      const lastSyncResultJson = await AsyncStorage.getItem('last_background_sync');
      const lastSyncResult = lastSyncResultJson ? JSON.parse(lastSyncResultJson) : undefined;

      return {
        isRegistered: this.isRegistered,
        lastSyncTime: this.lastSyncTime,
        backgroundFetchStatus,
        lastSyncResult,
      };
    } catch (error) {
      console.error('[BackgroundSync] Error getting status:', error);
      return {
        isRegistered: this.isRegistered,
        backgroundFetchStatus: 'unknown',
      };
    }
  }

  /**
   * Convert background fetch status to readable string
   */
  private getBackgroundFetchStatusString(status: any): string {
    if (!BackgroundFetch) return 'unavailable';
    
    switch (status) {
      case BackgroundFetch.BackgroundFetchStatus?.Available:
        return 'available';
      case BackgroundFetch.BackgroundFetchStatus?.Denied:
        return 'denied';
      case BackgroundFetch.BackgroundFetchStatus?.Restricted:
        return 'restricted';
      default:
        return 'unknown';
    }
  }

  /**
   * Unregister background tasks (for cleanup)
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isRegistered && BackgroundFetch && TaskManager) {
        // Unregister all tasks
        for (const taskName of this.registeredTasks.keys()) {
          await BackgroundFetch.unregisterTaskAsync(taskName);
          TaskManager.undefineTask(taskName);
          console.log(`[BackgroundSync] Unregistered ${taskName}`);
        }
        
        this.isRegistered = false;
        this.registeredTasks.clear();
        console.log('[BackgroundSync] All background tasks cleaned up');
      }
      
      // Cleanup performance optimizer
      performanceOptimizer.destroy();
      
      // Cleanup background task manager
      await backgroundTaskManager.destroy();
    } catch (error) {
      console.error('[BackgroundSync] Error during cleanup:', error);
    }
  }

  /**
   * Check if background processing should be throttled based on device state
   */
  shouldThrottleSync(): boolean {
    // Use performance optimizer for general throttling
    const shouldThrottle = performanceOptimizer.shouldThrottleSync('normal');
    
    // Add time-based throttle as additional check
    if (!this.lastSyncTime) return shouldThrottle;
    
    const lastSync = new Date(this.lastSyncTime);
    const minInterval = 6 * 60 * 60 * 1000; // 6 hours minimum between syncs
    const timeThrottle = (Date.now() - lastSync.getTime()) < minInterval;
    
    return shouldThrottle || timeThrottle;
  }

  /**
   * Check if a specific task should be throttled
   */
  private async shouldThrottleTask(taskName: string): Promise<boolean> {
    const taskConfig = this.registeredTasks.get(taskName);
    if (!taskConfig) return true;
    
    // Use performance optimizer for throttling decisions
    return performanceOptimizer.shouldThrottleSync(taskConfig.priority);
  }

  /**
   * Get recommended sync interval based on current conditions
   */
  getBackgroundSyncInterval(): number {
    // Use performance optimizer for adaptive intervals
    return performanceOptimizer.getAdaptiveSyncFrequency('normal');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get performance optimizer metrics
   */
  getOptimizerMetrics() {
    return performanceOptimizer.getMetrics();
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics() {
    return performanceOptimizer.getPerformanceAnalytics();
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    return performanceOptimizer.getPerformanceRecommendations();
  }

  /**
   * Update performance optimization settings
   */
  async updateOptimizationSettings(settings: any): Promise<void> {
    await performanceOptimizer.updateSettings(settings);
  }

  /**
   * Force a sync regardless of throttling (for user-initiated actions)
   */
  async forceSyncNow(): Promise<BackgroundSyncResult> {
    console.log('[BackgroundSync] Force syncing now');
    this.lastSyncTime = undefined; // Reset to bypass throttling
    return await this.executeBackgroundSync();
  }

  /**
   * Force process sync queue immediately
   */
  async forceProcessSyncQueue(): Promise<SyncResult> {
    console.log('[BackgroundSync] Force processing sync queue');
    this.isProcessing = true;
    
    try {
      const result = await this.processSyncQueueBatch();
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear sync queue (for testing or reset)
   */
  async clearSyncQueue(): Promise<void> {
    console.log('[BackgroundSync] Clearing sync queue');
    this.syncQueue = [];
    await this.saveSyncQueue();
  }

  /**
   * Get registered tasks info
   */
  getRegisteredTasks(): Array<{ name: string; config: BackgroundTaskConfig }> {
    return Array.from(this.registeredTasks.entries()).map(([name, config]) => ({
      name,
      config
    }));
  }

  /**
   * Get background task manager tasks
   */
  getBackgroundTasks() {
    return backgroundTaskManager.getAllTasks();
  }

  /**
   * Get active task executions
   */
  getActiveTaskExecutions() {
    return backgroundTaskManager.getActiveExecutions();
  }

  /**
   * Get task statistics
   */
  getTaskStatistics(taskId: string) {
    return backgroundTaskManager.getTaskStatistics(taskId);
  }

  /**
   * Get task history
   */
  getTaskHistory(taskId?: string) {
    return backgroundTaskManager.getTaskHistory(taskId);
  }

  /**
   * Enable/disable a background task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<void> {
    await backgroundTaskManager.setTaskEnabled(taskId, enabled);
  }

  /**
   * Force execute a background task
   */
  async forceExecuteTask(taskId: string) {
    return await backgroundTaskManager.forceExecuteTask(taskId);
  }

  /**
   * Get task manager state
   */
  getTaskManagerState() {
    return backgroundTaskManager.getState();
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();