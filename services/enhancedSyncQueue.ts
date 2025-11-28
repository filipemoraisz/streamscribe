import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { 
  SyncAction, 
  SyncResult, 
  QueueStatus, 
  SyncError,
  ConflictResolution,
  SyncBatch,
  DeviceActionTracker,
  OptimisticUpdate,
  RollbackOperation
} from '../types';
import { conflictResolutionService, ConflictDetectionResult } from './conflictResolution';
import { optimisticUpdateService, OptimisticUpdateResult, SyncStatusFeedback } from './optimisticUpdates';

export class EnhancedSyncQueue {
  private syncQueue: SyncAction[] = [];
  private deviceTrackers: Map<string, DeviceActionTracker> = new Map();
  private optimisticUpdates: Map<string, OptimisticUpdate> = new Map();
  private rollbackOperations: Map<string, RollbackOperation> = new Map();
  private isProcessing = false;
  private deviceId: string = '';
  private maxQueueSize = 1000;
  private batchSize = 20;
  private highPriorityBatchSize = 5;
  
  // Priority weights for action ordering
  private readonly PRIORITY_WEIGHTS = {
    high: 3,
    normal: 2,
    low: 1
  };

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.loadSyncQueue();
    this.loadDeviceTrackers();
    this.loadOptimisticUpdates();
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('enhanced_sync_queue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
        console.log(`[EnhancedSyncQueue] Loaded ${this.syncQueue.length} queued actions`);
      }
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('enhanced_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to save sync queue:', error);
    }
  }

  /**
   * Load device trackers from storage
   */
  private async loadDeviceTrackers(): Promise<void> {
    try {
      const trackersData = await AsyncStorage.getItem('device_trackers');
      if (trackersData) {
        const trackers = JSON.parse(trackersData);
        this.deviceTrackers = new Map(Object.entries(trackers));
      }
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to load device trackers:', error);
    }
  }

  /**
   * Save device trackers to storage
   */
  private async saveDeviceTrackers(): Promise<void> {
    try {
      const trackersObj = Object.fromEntries(this.deviceTrackers);
      await AsyncStorage.setItem('device_trackers', JSON.stringify(trackersObj));
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to save device trackers:', error);
    }
  }

  /**
   * Load optimistic updates from storage
   */
  private async loadOptimisticUpdates(): Promise<void> {
    try {
      const updatesData = await AsyncStorage.getItem('optimistic_updates');
      if (updatesData) {
        const updates = JSON.parse(updatesData);
        this.optimisticUpdates = new Map(Object.entries(updates));
      }
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to load optimistic updates:', error);
    }
  }

  /**
   * Save optimistic updates to storage
   */
  private async saveOptimisticUpdates(): Promise<void> {
    try {
      const updatesObj = Object.fromEntries(this.optimisticUpdates);
      await AsyncStorage.setItem('optimistic_updates', JSON.stringify(updatesObj));
    } catch (error) {
      console.error('[EnhancedSyncQueue] Failed to save optimistic updates:', error);
    }
  }

  /**
   * Add action to sync queue with priority and batching logic
   */
  queueAction(action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount' | 'deviceId' | 'priority'>, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const syncAction: SyncAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      deviceId: this.deviceId,
      priority,
      originalTimestamp: new Date().toISOString(),
      conflictResolution: this.getDefaultConflictResolution(action.type),
      ...action,
    };

    // Check for potential conflicts before adding
    this.detectPotentialConflicts(syncAction);

    // Add to queue with priority insertion
    this.insertActionByPriority(syncAction);

    // Update device tracker
    this.updateDeviceTracker(this.deviceId, 'queued');

    // Trim queue if it gets too large
    this.trimQueue();

    // Save queue
    this.saveSyncQueue();

    console.log(`[EnhancedSyncQueue] Queued ${priority} priority action: ${syncAction.type} (${syncAction.id})`);
    
    return syncAction.id;
  }

  /**
   * Queue action with optimistic update
   */
  async queueActionWithOptimisticUpdate(
    action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount' | 'deviceId' | 'priority'>,
    originalData: any,
    optimisticData: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<{ actionId: string; optimisticUpdateId: string }> {
    // Queue the action
    const actionId = this.queueAction(action, priority);
    
    // Apply optimistic update
    const updateType = this.getOptimisticUpdateType(action.type);
    const optimisticResult = await optimisticUpdateService.applyOptimisticUpdate(
      actionId,
      updateType,
      originalData,
      optimisticData
    );

    return {
      actionId,
      optimisticUpdateId: optimisticResult.updateId,
    };
  }

  /**
   * Get optimistic update type from action type
   */
  private getOptimisticUpdateType(actionType: string): 'progress' | 'watchlist' | 'preference' {
    switch (actionType) {
      case 'real_time_progress':
      case 'progress_update':
        return 'progress';
      case 'real_time_watchlist':
      case 'watchlist_change':
        return 'watchlist';
      case 'preference_update':
        return 'preference';
      default:
        return 'progress'; // Default fallback
    }
  }

  /**
   * Insert action into queue based on priority
   */
  private insertActionByPriority(action: SyncAction): void {
    const actionWeight = this.PRIORITY_WEIGHTS[action.priority];
    
    // Find insertion point based on priority and timestamp
    let insertIndex = this.syncQueue.length;
    
    for (let i = 0; i < this.syncQueue.length; i++) {
      const existingWeight = this.PRIORITY_WEIGHTS[this.syncQueue[i].priority];
      
      // Higher priority actions go first
      if (actionWeight > existingWeight) {
        insertIndex = i;
        break;
      }
      
      // Same priority, use timestamp (older first)
      if (actionWeight === existingWeight && action.timestamp < this.syncQueue[i].timestamp) {
        insertIndex = i;
        break;
      }
    }
    
    this.syncQueue.splice(insertIndex, 0, action);
  }

  /**
   * Get default conflict resolution strategy for action type
   */
  private getDefaultConflictResolution(actionType: string): 'last_write_wins' | 'merge' | 'manual' {
    switch (actionType) {
      case 'real_time_progress':
      case 'progress_update':
        return 'merge'; // Progress can often be merged
      case 'real_time_watchlist':
      case 'watchlist_change':
        return 'last_write_wins'; // Watchlist changes are usually definitive
      case 'preference_update':
        return 'last_write_wins'; // User preferences should use latest
      case 'streaming_availability_update':
      case 'episode_release_update':
        return 'merge'; // These can be merged as they're additive
      default:
        return 'last_write_wins';
    }
  }

  /**
   * Detect potential conflicts with existing actions
   */
  private detectPotentialConflicts(newAction: SyncAction): void {
    const conflictingActions = this.syncQueue.filter(existingAction => 
      this.actionsConflict(existingAction, newAction)
    );

    if (conflictingActions.length > 0) {
      console.log(`[EnhancedSyncQueue] Detected ${conflictingActions.length} potential conflicts for action ${newAction.id}`);
      
      // Mark actions for conflict resolution
      conflictingActions.forEach(conflictingAction => {
        if (!conflictingAction.batchId) {
          conflictingAction.batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        newAction.batchId = conflictingAction.batchId;
      });
    }
  }

  /**
   * Check if two actions conflict with each other
   */
  private actionsConflict(action1: SyncAction, action2: SyncAction): boolean {
    // Same device actions don't conflict (they're sequential)
    if (action1.deviceId === action2.deviceId) {
      return false;
    }

    // Check for same resource conflicts
    if (action1.type === action2.type) {
      switch (action1.type) {
        case 'progress_update':
        case 'real_time_progress':
          return this.progressActionsConflict(action1.payload, action2.payload);
        case 'watchlist_change':
        case 'real_time_watchlist':
          return this.watchlistActionsConflict(action1.payload, action2.payload);
        case 'preference_update':
          return action1.payload.userId === action2.payload.userId;
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Check if progress actions conflict
   */
  private progressActionsConflict(payload1: any, payload2: any): boolean {
    return payload1.showId === payload2.showId &&
           payload1.seasonNumber === payload2.seasonNumber &&
           payload1.episodeNumber === payload2.episodeNumber &&
           payload1.userId === payload2.userId;
  }

  /**
   * Check if watchlist actions conflict
   */
  private watchlistActionsConflict(payload1: any, payload2: any): boolean {
    return payload1.itemId === payload2.itemId &&
           payload1.userId === payload2.userId;
  }

  /**
   * Create batches for efficient processing
   */
  createBatches(): SyncBatch[] {
    const batches: SyncBatch[] = [];
    const highPriorityActions = this.syncQueue.filter(action => action.priority === 'high');
    const normalPriorityActions = this.syncQueue.filter(action => action.priority === 'normal');
    const lowPriorityActions = this.syncQueue.filter(action => action.priority === 'low');

    // Process high priority actions in smaller batches
    for (let i = 0; i < highPriorityActions.length; i += this.highPriorityBatchSize) {
      const batchActions = highPriorityActions.slice(i, i + this.highPriorityBatchSize);
      batches.push({
        id: `high_batch_${Date.now()}_${i}`,
        actions: batchActions,
        priority: 'high',
        createdAt: new Date().toISOString(),
        deviceId: this.deviceId,
      });
    }

    // Process normal and low priority actions in larger batches
    const regularActions = [...normalPriorityActions, ...lowPriorityActions];
    for (let i = 0; i < regularActions.length; i += this.batchSize) {
      const batchActions = regularActions.slice(i, i + this.batchSize);
      const batchPriority = batchActions.some(action => action.priority === 'normal') ? 'normal' : 'low';
      
      batches.push({
        id: `regular_batch_${Date.now()}_${i}`,
        actions: batchActions,
        priority: batchPriority,
        createdAt: new Date().toISOString(),
        deviceId: this.deviceId,
      });
    }

    return batches;
  }

  /**
   * Update device tracker statistics
   */
  private updateDeviceTracker(deviceId: string, operation: 'queued' | 'success' | 'failed' | 'conflict'): void {
    let tracker = this.deviceTrackers.get(deviceId);
    
    if (!tracker) {
      tracker = {
        deviceId,
        lastSyncTime: new Date().toISOString(),
        pendingActions: 0,
        conflictCount: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
      };
    }

    switch (operation) {
      case 'queued':
        tracker.pendingActions++;
        break;
      case 'success':
        tracker.pendingActions = Math.max(0, tracker.pendingActions - 1);
        tracker.successfulSyncs++;
        tracker.lastSyncTime = new Date().toISOString();
        break;
      case 'failed':
        tracker.pendingActions = Math.max(0, tracker.pendingActions - 1);
        tracker.failedSyncs++;
        break;
      case 'conflict':
        tracker.conflictCount++;
        break;
    }

    this.deviceTrackers.set(deviceId, tracker);
    this.saveDeviceTrackers();
  }

  /**
   * Get device tracker for a specific device
   */
  getDeviceTracker(deviceId: string): DeviceActionTracker | null {
    return this.deviceTrackers.get(deviceId) || null;
  }

  /**
   * Get all device trackers
   */
  getAllDeviceTrackers(): DeviceActionTracker[] {
    return Array.from(this.deviceTrackers.values());
  }

  /**
   * Trim queue to prevent memory issues
   */
  private trimQueue(): void {
    if (this.syncQueue.length > this.maxQueueSize) {
      // Remove oldest low priority actions first
      const lowPriorityActions = this.syncQueue.filter(action => action.priority === 'low');
      const actionsToRemove = Math.min(
        lowPriorityActions.length,
        this.syncQueue.length - this.maxQueueSize
      );

      if (actionsToRemove > 0) {
        const oldestLowPriority = lowPriorityActions
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .slice(0, actionsToRemove);

        oldestLowPriority.forEach(actionToRemove => {
          const index = this.syncQueue.findIndex(action => action.id === actionToRemove.id);
          if (index !== -1) {
            this.syncQueue.splice(index, 1);
          }
        });

        console.log(`[EnhancedSyncQueue] Trimmed ${actionsToRemove} low priority actions from queue`);
      }
    }
  }

  /**
   * Get queue status with enhanced information
   */
  getQueueStatus(): QueueStatus & {
    highPriorityActions: number;
    normalPriorityActions: number;
    lowPriorityActions: number;
    batchedActions: number;
    deviceTrackers: DeviceActionTracker[];
  } {
    const highPriorityActions = this.syncQueue.filter(action => action.priority === 'high').length;
    const normalPriorityActions = this.syncQueue.filter(action => action.priority === 'normal').length;
    const lowPriorityActions = this.syncQueue.filter(action => action.priority === 'low').length;
    const batchedActions = this.syncQueue.filter(action => action.batchId).length;

    return {
      pendingActions: this.syncQueue.length,
      lastSyncTime: this.getLastSyncTime(),
      isProcessing: this.isProcessing,
      errors: this.getRecentErrors(),
      highPriorityActions,
      normalPriorityActions,
      lowPriorityActions,
      batchedActions,
      deviceTrackers: this.getAllDeviceTrackers(),
    };
  }

  /**
   * Get last sync time from device trackers
   */
  private getLastSyncTime(): string {
    const trackers = Array.from(this.deviceTrackers.values());
    if (trackers.length === 0) return '';
    
    return trackers
      .map(tracker => tracker.lastSyncTime)
      .sort()
      .reverse()[0] || '';
  }

  /**
   * Get recent sync errors
   */
  private getRecentErrors(): SyncError[] {
    return conflictResolutionService.getSyncErrors();
  }

  /**
   * Process action with conflict detection and resolution
   */
  async processActionWithConflictResolution(action: SyncAction): Promise<{
    success: boolean;
    conflictResolved?: boolean;
    resolution?: ConflictResolution;
    error?: string;
  }> {
    try {
      // Update sync progress
      optimisticUpdateService.updateSyncProgress(action.id, 25, 'Checking for conflicts...');

      // Detect conflicts before processing
      const conflictResult = await conflictResolutionService.detectConflict(action);
      
      if (conflictResult.hasConflict) {
        console.log(`[EnhancedSyncQueue] Conflict detected for action ${action.id}: ${conflictResult.conflictType}`);
        
        // Update sync progress
        optimisticUpdateService.updateSyncProgress(action.id, 50, 'Resolving conflict...');

        // Resolve the conflict
        const resolutionStrategy = await conflictResolutionService.resolveConflict(conflictResult);
        
        // Handle optimistic update conflict
        const conflictResolutionStrategy = this.getConflictResolutionStrategy(resolutionStrategy.resolution);
        await optimisticUpdateService.handleConflictDetected(
          action.id,
          resolutionStrategy.resolvedData,
          conflictResolutionStrategy
        );
        
        // Update the action payload with resolved data
        action.payload = resolutionStrategy.resolvedData;
        
        // Update device tracker for conflict
        this.updateDeviceTracker(action.deviceId, 'conflict');
        
        return {
          success: true,
          conflictResolved: true,
          resolution: resolutionStrategy.resolution,
        };
      }
      
      // Update sync progress
      optimisticUpdateService.updateSyncProgress(action.id, 75, 'Processing sync...');
      
      return {
        success: true,
        conflictResolved: false,
      };
      
    } catch (error) {
      console.error(`[EnhancedSyncQueue] Error processing action with conflict resolution:`, error);
      
      // Rollback optimistic update on error
      await optimisticUpdateService.rollbackOptimisticUpdate(
        action.id,
        'sync_failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get conflict resolution strategy for optimistic updates
   */
  private getConflictResolutionStrategy(resolution: ConflictResolution): 'keep_local' | 'use_remote' | 'merge' {
    switch (resolution.resolution) {
      case 'local_wins':
        return 'keep_local';
      case 'remote_wins':
        return 'use_remote';
      case 'merged':
        return 'merge';
      default:
        return 'use_remote';
    }
  }

  /**
   * Batch process actions with conflict resolution
   */
  async processBatchWithConflictResolution(actions: SyncAction[]): Promise<{
    processedActions: SyncAction[];
    conflictResolutions: ConflictResolution[];
    errors: { actionId: string; error: string }[];
  }> {
    const processedActions: SyncAction[] = [];
    const conflictResolutions: ConflictResolution[] = [];
    const errors: { actionId: string; error: string }[] = [];

    for (const action of actions) {
      try {
        const result = await this.processActionWithConflictResolution(action);
        
        if (result.success) {
          processedActions.push(action);
          
          if (result.conflictResolved && result.resolution) {
            conflictResolutions.push(result.resolution);
          }
        } else {
          errors.push({
            actionId: action.id,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        errors.push({
          actionId: action.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processedActions,
      conflictResolutions,
      errors,
    };
  }

  /**
   * Clear processed actions from queue
   */
  clearProcessedActions(actionIds: string[]): void {
    const initialLength = this.syncQueue.length;
    this.syncQueue = this.syncQueue.filter(action => !actionIds.includes(action.id));
    const removedCount = initialLength - this.syncQueue.length;
    
    if (removedCount > 0) {
      console.log(`[EnhancedSyncQueue] Cleared ${removedCount} processed actions from queue`);
      this.saveSyncQueue();
    }
  }

  /**
   * Get actions by priority
   */
  getActionsByPriority(priority: 'high' | 'normal' | 'low'): SyncAction[] {
    return this.syncQueue.filter(action => action.priority === priority);
  }

  /**
   * Get actions by device
   */
  getActionsByDevice(deviceId: string): SyncAction[] {
    return this.syncQueue.filter(action => action.deviceId === deviceId);
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: string): SyncAction[] {
    return this.syncQueue.filter(action => action.type === type);
  }

  /**
   * Get all queued actions (for debugging)
   */
  getAllActions(): SyncAction[] {
    return [...this.syncQueue];
  }

  /**
   * Clear all actions (for testing/reset)
   */
  clearAllActions(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
    console.log('[EnhancedSyncQueue] Cleared all actions from queue');
  }

  /**
   * Get conflict resolution history
   */
  getConflictHistory(): ConflictResolution[] {
    return conflictResolutionService.getConflictHistory();
  }

  /**
   * Get conflict statistics
   */
  getConflictStatistics() {
    return conflictResolutionService.getConflictStatistics();
  }

  /**
   * Clear old conflict logs
   */
  async clearOldConflictLogs(olderThanDays: number = 7): Promise<void> {
    await conflictResolutionService.clearOldLogs(olderThanDays);
  }

  /**
   * Confirm successful sync for optimistic update
   */
  async confirmOptimisticUpdate(actionId: string): Promise<void> {
    await optimisticUpdateService.confirmOptimisticUpdate(actionId);
    this.updateDeviceTracker(this.deviceId, 'success');
  }

  /**
   * Rollback failed sync for optimistic update
   */
  async rollbackOptimisticUpdate(actionId: string, reason: string): Promise<void> {
    await optimisticUpdateService.rollbackOptimisticUpdate(actionId, 'sync_failed', reason);
    this.updateDeviceTracker(this.deviceId, 'failed');
  }

  /**
   * Register sync status callback
   */
  onSyncStatusChange(actionId: string, callback: (status: SyncStatusFeedback) => void): void {
    optimisticUpdateService.onSyncStatusChange(actionId, callback);
  }

  /**
   * Unregister sync status callback
   */
  offSyncStatusChange(actionId: string): void {
    optimisticUpdateService.offSyncStatusChange(actionId);
  }

  /**
   * Get pending optimistic updates
   */
  getPendingOptimisticUpdates(): OptimisticUpdate[] {
    return optimisticUpdateService.getPendingUpdates();
  }

  /**
   * Get optimistic update statistics
   */
  getOptimisticUpdateStatistics() {
    return optimisticUpdateService.getOptimisticUpdateStatistics();
  }

  /**
   * Clear old optimistic update data
   */
  async clearOldOptimisticData(olderThanMinutes: number = 60): Promise<void> {
    await optimisticUpdateService.clearOldData(olderThanMinutes);
  }

  /**
   * Get queue statistics
   */
  getQueueStatistics(): {
    totalActions: number;
    actionsByPriority: Record<string, number>;
    actionsByType: Record<string, number>;
    actionsByDevice: Record<string, number>;
    averageRetryCount: number;
    oldestActionAge: number;
  } {
    const actionsByPriority: Record<string, number> = { high: 0, normal: 0, low: 0 };
    const actionsByType: Record<string, number> = {};
    const actionsByDevice: Record<string, number> = {};
    let totalRetries = 0;
    let oldestTimestamp = Date.now();

    this.syncQueue.forEach(action => {
      actionsByPriority[action.priority]++;
      actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
      actionsByDevice[action.deviceId] = (actionsByDevice[action.deviceId] || 0) + 1;
      totalRetries += action.retryCount;
      
      const actionTime = new Date(action.timestamp).getTime();
      if (actionTime < oldestTimestamp) {
        oldestTimestamp = actionTime;
      }
    });

    return {
      totalActions: this.syncQueue.length,
      actionsByPriority,
      actionsByType,
      actionsByDevice,
      averageRetryCount: this.syncQueue.length > 0 ? totalRetries / this.syncQueue.length : 0,
      oldestActionAge: this.syncQueue.length > 0 ? Date.now() - oldestTimestamp : 0,
    };
  }
}