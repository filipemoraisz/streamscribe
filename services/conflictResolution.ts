import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { 
  SyncAction, 
  ConflictResolution, 
  SyncError 
} from '../types';

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType: 'timestamp' | 'concurrent_update' | 'data_mismatch' | 'none';
  localAction: SyncAction;
  remoteData?: any;
  conflictDetails: string;
}

export interface ConflictResolutionStrategy {
  strategy: 'last_write_wins' | 'merge' | 'manual';
  resolvedData: any;
  resolution: ConflictResolution;
}

export class ConflictResolutionService {
  private conflictLog: ConflictResolution[] = [];
  private syncErrors: SyncError[] = [];
  private maxConflictLogSize = 100;
  private maxErrorLogSize = 50;

  constructor() {
    this.loadConflictLog();
    this.loadSyncErrors();
  }

  /**
   * Load conflict log from storage
   */
  private async loadConflictLog(): Promise<void> {
    try {
      const logData = await AsyncStorage.getItem('conflict_resolution_log');
      if (logData) {
        this.conflictLog = JSON.parse(logData);
      }
    } catch (error) {
      console.error('[ConflictResolution] Failed to load conflict log:', error);
      this.conflictLog = [];
    }
  }

  /**
   * Save conflict log to storage
   */
  private async saveConflictLog(): Promise<void> {
    try {
      await AsyncStorage.setItem('conflict_resolution_log', JSON.stringify(this.conflictLog));
    } catch (error) {
      console.error('[ConflictResolution] Failed to save conflict log:', error);
    }
  }

  /**
   * Load sync errors from storage
   */
  private async loadSyncErrors(): Promise<void> {
    try {
      const errorsData = await AsyncStorage.getItem('sync_errors_log');
      if (errorsData) {
        this.syncErrors = JSON.parse(errorsData);
      }
    } catch (error) {
      console.error('[ConflictResolution] Failed to load sync errors:', error);
      this.syncErrors = [];
    }
  }

  /**
   * Save sync errors to storage
   */
  private async saveSyncErrors(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_errors_log', JSON.stringify(this.syncErrors));
    } catch (error) {
      console.error('[ConflictResolution] Failed to save sync errors:', error);
    }
  }

  /**
   * Detect conflicts for a given action against remote data
   */
  async detectConflict(action: SyncAction): Promise<ConflictDetectionResult> {
    try {
      const remoteData = await this.fetchRemoteData(action);
      
      if (!remoteData) {
        return {
          hasConflict: false,
          conflictType: 'none',
          localAction: action,
          conflictDetails: 'No remote data found',
        };
      }

      // Check for timestamp-based conflicts
      const timestampConflict = this.checkTimestampConflict(action, remoteData);
      if (timestampConflict.hasConflict) {
        return timestampConflict;
      }

      // Check for concurrent update conflicts
      const concurrentConflict = this.checkConcurrentUpdateConflict(action, remoteData);
      if (concurrentConflict.hasConflict) {
        return concurrentConflict;
      }

      // Check for data mismatch conflicts
      const dataMismatchConflict = this.checkDataMismatchConflict(action, remoteData);
      if (dataMismatchConflict.hasConflict) {
        return dataMismatchConflict;
      }

      return {
        hasConflict: false,
        conflictType: 'none',
        localAction: action,
        remoteData,
        conflictDetails: 'No conflicts detected',
      };

    } catch (error) {
      console.error('[ConflictResolution] Error detecting conflict:', error);
      
      // Log the error
      this.logSyncError(action, error instanceof Error ? error.message : 'Unknown error');
      
      return {
        hasConflict: false,
        conflictType: 'none',
        localAction: action,
        conflictDetails: 'Error during conflict detection',
      };
    }
  }

  /**
   * Fetch remote data for conflict comparison
   */
  private async fetchRemoteData(action: SyncAction): Promise<any> {
    switch (action.type) {
      case 'real_time_progress':
      case 'progress_update':
        return await this.fetchProgressData(action.payload);
      case 'real_time_watchlist':
      case 'watchlist_change':
        return await this.fetchWatchlistData(action.payload);
      case 'preference_update':
        return await this.fetchPreferenceData(action.payload);
      default:
        return null;
    }
  }

  /**
   * Fetch progress data from remote
   */
  private async fetchProgressData(payload: any): Promise<any> {
    const { userId, showId, seasonNumber, episodeNumber } = payload;
    
    const { data, error } = await supabase
      .from('episode_progress')
      .select('*')
      .match({
        user_id: userId,
        show_id: showId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
      })
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }

    return data;
  }

  /**
   * Fetch watchlist data from remote
   */
  private async fetchWatchlistData(payload: any): Promise<any> {
    const { userId, itemId } = payload;
    
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .match({
        user_id: userId,
        item_id: itemId,
      })
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Fetch preference data from remote
   */
  private async fetchPreferenceData(payload: any): Promise<any> {
    const { userId } = payload;
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .match({ user_id: userId })
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Check for timestamp-based conflicts
   */
  private checkTimestampConflict(action: SyncAction, remoteData: any): ConflictDetectionResult {
    if (!remoteData.updated_at || !action.originalTimestamp) {
      return {
        hasConflict: false,
        conflictType: 'none',
        localAction: action,
        remoteData,
        conflictDetails: 'Missing timestamp data',
      };
    }

    const localTimestamp = new Date(action.originalTimestamp);
    const remoteTimestamp = new Date(remoteData.updated_at);
    
    // Check if remote data was updated after local action was created
    if (remoteTimestamp > localTimestamp) {
      // Additional check: see if the update came from a different device
      if (remoteData.device_id && remoteData.device_id !== action.deviceId) {
        return {
          hasConflict: true,
          conflictType: 'timestamp',
          localAction: action,
          remoteData,
          conflictDetails: `Remote data updated at ${remoteTimestamp.toISOString()} by device ${remoteData.device_id}, local action from ${localTimestamp.toISOString()} by device ${action.deviceId}`,
        };
      }
    }

    return {
      hasConflict: false,
      conflictType: 'none',
      localAction: action,
      remoteData,
      conflictDetails: 'No timestamp conflict',
    };
  }

  /**
   * Check for concurrent update conflicts
   */
  private checkConcurrentUpdateConflict(action: SyncAction, remoteData: any): ConflictDetectionResult {
    // Check if there's a sync_timestamp indicating when the remote data was synced
    if (!remoteData.sync_timestamp) {
      return {
        hasConflict: false,
        conflictType: 'none',
        localAction: action,
        remoteData,
        conflictDetails: 'No sync timestamp available',
      };
    }

    const localSyncTime = new Date(action.originalTimestamp || action.timestamp);
    const remoteSyncTime = new Date(remoteData.sync_timestamp);
    
    // If sync times are very close (within 5 seconds), it might be a concurrent update
    const timeDiff = Math.abs(localSyncTime.getTime() - remoteSyncTime.getTime());
    const concurrentThreshold = 5000; // 5 seconds
    
    if (timeDiff < concurrentThreshold && remoteData.device_id !== action.deviceId) {
      return {
        hasConflict: true,
        conflictType: 'concurrent_update',
        localAction: action,
        remoteData,
        conflictDetails: `Concurrent update detected: local sync at ${localSyncTime.toISOString()}, remote sync at ${remoteSyncTime.toISOString()} (${timeDiff}ms apart)`,
      };
    }

    return {
      hasConflict: false,
      conflictType: 'none',
      localAction: action,
      remoteData,
      conflictDetails: 'No concurrent update conflict',
    };
  }

  /**
   * Check for data mismatch conflicts
   */
  private checkDataMismatchConflict(action: SyncAction, remoteData: any): ConflictDetectionResult {
    // This is action-type specific conflict detection
    switch (action.type) {
      case 'real_time_progress':
      case 'progress_update':
        return this.checkProgressDataMismatch(action, remoteData);
      case 'real_time_watchlist':
      case 'watchlist_change':
        return this.checkWatchlistDataMismatch(action, remoteData);
      default:
        return {
          hasConflict: false,
          conflictType: 'none',
          localAction: action,
          remoteData,
          conflictDetails: 'No data mismatch check for this action type',
        };
    }
  }

  /**
   * Check progress data mismatch
   */
  private checkProgressDataMismatch(action: SyncAction, remoteData: any): ConflictDetectionResult {
    const localWatched = action.payload.watched;
    const remoteWatched = remoteData.watched;
    
    // If both are trying to set different watched states, it's a conflict
    if (localWatched !== remoteWatched && remoteData.device_id !== action.deviceId) {
      return {
        hasConflict: true,
        conflictType: 'data_mismatch',
        localAction: action,
        remoteData,
        conflictDetails: `Progress mismatch: local wants watched=${localWatched}, remote has watched=${remoteWatched}`,
      };
    }

    return {
      hasConflict: false,
      conflictType: 'none',
      localAction: action,
      remoteData,
      conflictDetails: 'No progress data mismatch',
    };
  }

  /**
   * Check watchlist data mismatch
   */
  private checkWatchlistDataMismatch(action: SyncAction, remoteData: any): ConflictDetectionResult {
    const localOperation = action.payload.operation;
    
    // If local wants to add but remote already exists, or local wants to remove but remote doesn't exist
    if (localOperation === 'add' && remoteData) {
      return {
        hasConflict: true,
        conflictType: 'data_mismatch',
        localAction: action,
        remoteData,
        conflictDetails: 'Trying to add item that already exists remotely',
      };
    }
    
    if (localOperation === 'remove' && !remoteData) {
      return {
        hasConflict: true,
        conflictType: 'data_mismatch',
        localAction: action,
        remoteData,
        conflictDetails: 'Trying to remove item that does not exist remotely',
      };
    }

    return {
      hasConflict: false,
      conflictType: 'none',
      localAction: action,
      remoteData,
      conflictDetails: 'No watchlist data mismatch',
    };
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(
    conflictResult: ConflictDetectionResult,
    strategy?: 'last_write_wins' | 'merge' | 'manual'
  ): Promise<ConflictResolutionStrategy> {
    const resolutionStrategy = strategy || conflictResult.localAction.conflictResolution || 'last_write_wins';
    
    let resolvedData: any;
    let resolution: ConflictResolution;

    switch (resolutionStrategy) {
      case 'last_write_wins':
        resolvedData = await this.resolveLastWriteWins(conflictResult);
        resolution = this.createResolution(conflictResult, 'local_wins', 'Applied last-write-wins strategy');
        break;
        
      case 'merge':
        resolvedData = await this.resolveMerge(conflictResult);
        resolution = this.createResolution(conflictResult, 'merged', 'Applied merge strategy');
        break;
        
      case 'manual':
        resolvedData = conflictResult.remoteData; // Keep remote data for manual resolution
        resolution = this.createResolution(conflictResult, 'remote_wins', 'Marked for manual resolution');
        break;
        
      default:
        resolvedData = conflictResult.localAction.payload;
        resolution = this.createResolution(conflictResult, 'local_wins', 'Default resolution');
    }

    // Log the resolution
    this.logConflictResolution(resolution);

    return {
      strategy: resolutionStrategy,
      resolvedData,
      resolution,
    };
  }

  /**
   * Resolve using last-write-wins strategy
   */
  private async resolveLastWriteWins(conflictResult: ConflictDetectionResult): Promise<any> {
    const localTimestamp = new Date(conflictResult.localAction.originalTimestamp || conflictResult.localAction.timestamp);
    const remoteTimestamp = new Date(conflictResult.remoteData?.updated_at || 0);
    
    // Use the data from the most recent timestamp
    if (localTimestamp > remoteTimestamp) {
      console.log('[ConflictResolution] Local action wins (newer timestamp)');
      return conflictResult.localAction.payload;
    } else {
      console.log('[ConflictResolution] Remote data wins (newer timestamp)');
      return conflictResult.remoteData;
    }
  }

  /**
   * Resolve using merge strategy
   */
  private async resolveMerge(conflictResult: ConflictDetectionResult): Promise<any> {
    switch (conflictResult.localAction.type) {
      case 'real_time_progress':
      case 'progress_update':
        return this.mergeProgressData(conflictResult);
      case 'real_time_watchlist':
      case 'watchlist_change':
        return this.mergeWatchlistData(conflictResult);
      default:
        // Fall back to last-write-wins for unsupported types
        return this.resolveLastWriteWins(conflictResult);
    }
  }

  /**
   * Merge progress data intelligently
   */
  private mergeProgressData(conflictResult: ConflictDetectionResult): any {
    const localPayload = conflictResult.localAction.payload;
    const remoteData = conflictResult.remoteData;
    
    // For progress, if either local or remote says watched=true, use true
    // This handles the case where user watches on multiple devices
    const mergedWatched = localPayload.watched || remoteData.watched;
    
    // Use the most recent watched_date
    let mergedWatchedDate = null;
    if (localPayload.watched && remoteData.watched_date) {
      const localDate = new Date(localPayload.watchedDate || localPayload.timestamp);
      const remoteDate = new Date(remoteData.watched_date);
      mergedWatchedDate = localDate > remoteDate ? localDate.toISOString() : remoteData.watched_date;
    } else if (localPayload.watched) {
      mergedWatchedDate = localPayload.watchedDate || new Date().toISOString();
    } else if (remoteData.watched_date) {
      mergedWatchedDate = remoteData.watched_date;
    }
    
    console.log('[ConflictResolution] Merged progress data: watched =', mergedWatched);
    
    return {
      ...localPayload,
      watched: mergedWatched,
      watchedDate: mergedWatchedDate,
    };
  }

  /**
   * Merge watchlist data intelligently
   */
  private mergeWatchlistData(conflictResult: ConflictDetectionResult): any {
    const localPayload = conflictResult.localAction.payload;
    const remoteData = conflictResult.remoteData;
    
    // For watchlist, merge based on operation type
    if (localPayload.operation === 'add' && remoteData) {
      // Item already exists, update with local data if it's newer
      console.log('[ConflictResolution] Merging watchlist: updating existing item');
      return {
        ...localPayload,
        operation: 'update',
        itemData: {
          ...remoteData,
          ...localPayload.itemData,
        },
      };
    }
    
    if (localPayload.operation === 'remove' && !remoteData) {
      // Item doesn't exist, no-op
      console.log('[ConflictResolution] Merging watchlist: item already removed');
      return null; // No action needed
    }
    
    // Default to local payload
    return localPayload;
  }

  /**
   * Create conflict resolution record
   */
  private createResolution(
    conflictResult: ConflictDetectionResult,
    resolution: 'local_wins' | 'remote_wins' | 'merged',
    details: string
  ): ConflictResolution {
    return {
      actionId: conflictResult.localAction.id,
      conflictingActionId: conflictResult.remoteData?.id,
      resolution,
      details: `${details}. Conflict type: ${conflictResult.conflictType}. ${conflictResult.conflictDetails}`,
      timestamp: new Date().toISOString(),
      deviceIds: [
        conflictResult.localAction.deviceId,
        conflictResult.remoteData?.device_id,
      ].filter(Boolean),
    };
  }

  /**
   * Log conflict resolution
   */
  private logConflictResolution(resolution: ConflictResolution): void {
    this.conflictLog.push(resolution);
    
    // Trim log if it gets too large
    if (this.conflictLog.length > this.maxConflictLogSize) {
      this.conflictLog = this.conflictLog.slice(-this.maxConflictLogSize);
    }
    
    this.saveConflictLog();
    console.log('[ConflictResolution] Logged conflict resolution:', resolution.actionId, resolution.resolution);
  }

  /**
   * Log sync error
   */
  private logSyncError(action: SyncAction, error: string): void {
    const syncError: SyncError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      action,
      error,
      timestamp: new Date().toISOString(),
    };
    
    this.syncErrors.push(syncError);
    
    // Trim error log if it gets too large
    if (this.syncErrors.length > this.maxErrorLogSize) {
      this.syncErrors = this.syncErrors.slice(-this.maxErrorLogSize);
    }
    
    this.saveSyncErrors();
    console.error('[ConflictResolution] Logged sync error:', syncError.id, error);
  }

  /**
   * Get conflict resolution history
   */
  getConflictHistory(): ConflictResolution[] {
    return [...this.conflictLog];
  }

  /**
   * Get sync error history
   */
  getSyncErrors(): SyncError[] {
    return [...this.syncErrors];
  }

  /**
   * Get conflict statistics
   */
  getConflictStatistics(): {
    totalConflicts: number;
    resolutionsByType: Record<string, number>;
    conflictsByDevice: Record<string, number>;
    recentConflicts: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const resolutionsByType: Record<string, number> = {};
    const conflictsByDevice: Record<string, number> = {};
    let recentConflicts = 0;
    
    this.conflictLog.forEach(conflict => {
      resolutionsByType[conflict.resolution] = (resolutionsByType[conflict.resolution] || 0) + 1;
      
      conflict.deviceIds.forEach(deviceId => {
        conflictsByDevice[deviceId] = (conflictsByDevice[deviceId] || 0) + 1;
      });
      
      if (new Date(conflict.timestamp).getTime() > oneHourAgo) {
        recentConflicts++;
      }
    });
    
    return {
      totalConflicts: this.conflictLog.length,
      resolutionsByType,
      conflictsByDevice,
      recentConflicts,
    };
  }

  /**
   * Clear old conflict logs and errors
   */
  async clearOldLogs(olderThanDays: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    this.conflictLog = this.conflictLog.filter(
      conflict => new Date(conflict.timestamp).getTime() > cutoffTime
    );
    
    this.syncErrors = this.syncErrors.filter(
      error => new Date(error.timestamp).getTime() > cutoffTime
    );
    
    await Promise.all([
      this.saveConflictLog(),
      this.saveSyncErrors(),
    ]);
    
    console.log('[ConflictResolution] Cleared old logs and errors');
  }
}

// Singleton instance
export const conflictResolutionService = new ConflictResolutionService();