import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  OptimisticUpdate, 
  RollbackOperation, 
  SyncAction 
} from '../types';

export interface OptimisticUpdateResult {
  updateId: string;
  applied: boolean;
  originalData: any;
  optimisticData: any;
}

export interface RollbackResult {
  rollbackId: string;
  success: boolean;
  restoredData: any;
  error?: string;
}

export interface SyncStatusFeedback {
  actionId: string;
  status: 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  message: string;
  timestamp: string;
  progress?: number; // 0-100 for progress indication
}

export class OptimisticUpdateService {
  private optimisticUpdates: Map<string, OptimisticUpdate> = new Map();
  private rollbackOperations: Map<string, RollbackOperation> = new Map();
  private syncStatusCallbacks: Map<string, (status: SyncStatusFeedback) => void> = new Map();
  private maxUpdatesHistory = 100;
  private maxRollbackHistory = 50;

  constructor() {
    this.loadOptimisticUpdates();
    this.loadRollbackOperations();
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
      console.error('[OptimisticUpdates] Failed to load optimistic updates:', error);
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
      console.error('[OptimisticUpdates] Failed to save optimistic updates:', error);
    }
  }

  /**
   * Load rollback operations from storage
   */
  private async loadRollbackOperations(): Promise<void> {
    try {
      const rollbackData = await AsyncStorage.getItem('rollback_operations');
      if (rollbackData) {
        const rollbacks = JSON.parse(rollbackData);
        this.rollbackOperations = new Map(Object.entries(rollbacks));
      }
    } catch (error) {
      console.error('[OptimisticUpdates] Failed to load rollback operations:', error);
    }
  }

  /**
   * Save rollback operations to storage
   */
  private async saveRollbackOperations(): Promise<void> {
    try {
      const rollbackObj = Object.fromEntries(this.rollbackOperations);
      await AsyncStorage.setItem('rollback_operations', JSON.stringify(rollbackObj));
    } catch (error) {
      console.error('[OptimisticUpdates] Failed to save rollback operations:', error);
    }
  }

  /**
   * Apply optimistic update immediately to UI
   */
  async applyOptimisticUpdate(
    actionId: string,
    type: 'progress' | 'watchlist' | 'preference',
    originalData: any,
    optimisticData: any
  ): Promise<OptimisticUpdateResult> {
    const updateId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const optimisticUpdate: OptimisticUpdate = {
      id: updateId,
      actionId,
      type,
      originalData,
      optimisticData,
      timestamp: new Date().toISOString(),
      applied: true,
    };

    this.optimisticUpdates.set(updateId, optimisticUpdate);
    await this.saveOptimisticUpdates();

    // Notify sync status
    this.notifySyncStatus(actionId, {
      actionId,
      status: 'pending',
      message: 'Update applied locally, syncing...',
      timestamp: new Date().toISOString(),
      progress: 10,
    });

    console.log(`[OptimisticUpdates] Applied optimistic update ${updateId} for action ${actionId}`);

    return {
      updateId,
      applied: true,
      originalData,
      optimisticData,
    };
  }

  /**
   * Confirm optimistic update when sync succeeds
   */
  async confirmOptimisticUpdate(actionId: string): Promise<void> {
    const update = this.findUpdateByActionId(actionId);
    
    if (update) {
      // Remove from optimistic updates since it's now confirmed
      this.optimisticUpdates.delete(update.id);
      await this.saveOptimisticUpdates();

      // Notify success
      this.notifySyncStatus(actionId, {
        actionId,
        status: 'success',
        message: 'Successfully synced',
        timestamp: new Date().toISOString(),
        progress: 100,
      });

      console.log(`[OptimisticUpdates] Confirmed optimistic update for action ${actionId}`);
    }
  }

  /**
   * Rollback optimistic update when sync fails
   */
  async rollbackOptimisticUpdate(
    actionId: string,
    reason: 'sync_failed' | 'conflict_detected' | 'manual_rollback',
    errorMessage?: string
  ): Promise<RollbackResult> {
    const update = this.findUpdateByActionId(actionId);
    
    if (!update) {
      return {
        rollbackId: '',
        success: false,
        restoredData: null,
        error: 'Optimistic update not found',
      };
    }

    const rollbackId = `rollback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const rollbackOperation: RollbackOperation = {
      id: rollbackId,
      optimisticUpdateId: update.id,
      reason,
      timestamp: new Date().toISOString(),
      rollbackData: update.originalData,
    };

    try {
      // Store rollback operation
      this.rollbackOperations.set(rollbackId, rollbackOperation);
      await this.saveRollbackOperations();

      // Remove optimistic update
      this.optimisticUpdates.delete(update.id);
      await this.saveOptimisticUpdates();

      // Notify failure
      this.notifySyncStatus(actionId, {
        actionId,
        status: 'failed',
        message: errorMessage || `Sync failed: ${reason}`,
        timestamp: new Date().toISOString(),
        progress: 0,
      });

      console.log(`[OptimisticUpdates] Rolled back optimistic update ${update.id} for action ${actionId}`);

      return {
        rollbackId,
        success: true,
        restoredData: update.originalData,
      };

    } catch (error) {
      console.error('[OptimisticUpdates] Failed to rollback optimistic update:', error);
      
      return {
        rollbackId,
        success: false,
        restoredData: update.originalData,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle conflict detected during sync
   */
  async handleConflictDetected(
    actionId: string,
    conflictData: any,
    resolutionStrategy: 'keep_local' | 'use_remote' | 'merge'
  ): Promise<RollbackResult | OptimisticUpdateResult> {
    const update = this.findUpdateByActionId(actionId);
    
    if (!update) {
      return {
        rollbackId: '',
        success: false,
        restoredData: null,
        error: 'Optimistic update not found',
      };
    }

    // Notify conflict status
    this.notifySyncStatus(actionId, {
      actionId,
      status: 'conflict',
      message: 'Conflict detected, resolving...',
      timestamp: new Date().toISOString(),
      progress: 50,
    });

    switch (resolutionStrategy) {
      case 'keep_local':
        // Keep the optimistic update, mark as confirmed
        await this.confirmOptimisticUpdate(actionId);
        return {
          updateId: update.id,
          applied: true,
          originalData: update.originalData,
          optimisticData: update.optimisticData,
        };

      case 'use_remote':
        // Rollback to original, then apply remote data
        const rollbackResult = await this.rollbackOptimisticUpdate(
          actionId, 
          'conflict_detected',
          'Using remote data due to conflict'
        );
        
        // Apply remote data as new optimistic update
        const newUpdate = await this.applyOptimisticUpdate(
          actionId,
          update.type,
          update.originalData,
          conflictData
        );
        
        // Immediately confirm since it's from remote
        await this.confirmOptimisticUpdate(actionId);
        
        return newUpdate;

      case 'merge':
        // Update optimistic data with merged result
        const mergedData = this.mergeConflictData(update.optimisticData, conflictData, update.type);
        
        // Update the optimistic update with merged data
        update.optimisticData = mergedData;
        this.optimisticUpdates.set(update.id, update);
        await this.saveOptimisticUpdates();
        
        // Confirm the merged update
        await this.confirmOptimisticUpdate(actionId);
        
        return {
          updateId: update.id,
          applied: true,
          originalData: update.originalData,
          optimisticData: mergedData,
        };

      default:
        return await this.rollbackOptimisticUpdate(actionId, 'conflict_detected');
    }
  }

  /**
   * Merge conflict data based on update type
   */
  private mergeConflictData(localData: any, remoteData: any, type: string): any {
    switch (type) {
      case 'progress':
        // For progress, merge watched status (true wins) and use latest timestamp
        return {
          ...localData,
          watched: localData.watched || remoteData.watched,
          watchedDate: this.getLatestTimestamp(localData.watchedDate, remoteData.watched_date),
        };

      case 'watchlist':
        // For watchlist, merge item data
        return {
          ...localData,
          itemData: {
            ...remoteData,
            ...localData.itemData,
          },
        };

      case 'preference':
        // For preferences, use local data but merge arrays
        return {
          ...remoteData,
          ...localData,
          // Merge arrays like subscribed services
          subscribedServices: [
            ...(remoteData.subscribedServices || []),
            ...(localData.subscribedServices || []),
          ].filter((service, index, arr) => arr.indexOf(service) === index),
        };

      default:
        return localData;
    }
  }

  /**
   * Get the latest timestamp between two dates
   */
  private getLatestTimestamp(date1?: string, date2?: string): string {
    if (!date1 && !date2) return new Date().toISOString();
    if (!date1) return date2!;
    if (!date2) return date1;
    
    return new Date(date1) > new Date(date2) ? date1 : date2;
  }

  /**
   * Find optimistic update by action ID
   */
  private findUpdateByActionId(actionId: string): OptimisticUpdate | null {
    for (const update of this.optimisticUpdates.values()) {
      if (update.actionId === actionId) {
        return update;
      }
    }
    return null;
  }

  /**
   * Register callback for sync status updates
   */
  onSyncStatusChange(actionId: string, callback: (status: SyncStatusFeedback) => void): void {
    this.syncStatusCallbacks.set(actionId, callback);
  }

  /**
   * Unregister sync status callback
   */
  offSyncStatusChange(actionId: string): void {
    this.syncStatusCallbacks.delete(actionId);
  }

  /**
   * Notify sync status change
   */
  private notifySyncStatus(actionId: string, status: SyncStatusFeedback): void {
    const callback = this.syncStatusCallbacks.get(actionId);
    if (callback) {
      try {
        callback(status);
      } catch (error) {
        console.error('[OptimisticUpdates] Error in sync status callback:', error);
      }
    }
  }

  /**
   * Update sync progress
   */
  updateSyncProgress(actionId: string, progress: number, message?: string): void {
    this.notifySyncStatus(actionId, {
      actionId,
      status: 'syncing',
      message: message || 'Syncing...',
      timestamp: new Date().toISOString(),
      progress: Math.max(0, Math.min(100, progress)),
    });
  }

  /**
   * Get all pending optimistic updates
   */
  getPendingUpdates(): OptimisticUpdate[] {
    return Array.from(this.optimisticUpdates.values()).filter(update => update.applied);
  }

  /**
   * Get optimistic update by ID
   */
  getOptimisticUpdate(updateId: string): OptimisticUpdate | null {
    return this.optimisticUpdates.get(updateId) || null;
  }

  /**
   * Get rollback operation by ID
   */
  getRollbackOperation(rollbackId: string): RollbackOperation | null {
    return this.rollbackOperations.get(rollbackId) || null;
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(): RollbackOperation[] {
    return Array.from(this.rollbackOperations.values());
  }

  /**
   * Get optimistic update statistics
   */
  getOptimisticUpdateStatistics(): {
    totalUpdates: number;
    pendingUpdates: number;
    updatesByType: Record<string, number>;
    rollbacksByReason: Record<string, number>;
    averageUpdateAge: number;
  } {
    const updates = Array.from(this.optimisticUpdates.values());
    const rollbacks = Array.from(this.rollbackOperations.values());
    
    const updatesByType: Record<string, number> = {};
    const rollbacksByReason: Record<string, number> = {};
    let totalAge = 0;

    updates.forEach(update => {
      updatesByType[update.type] = (updatesByType[update.type] || 0) + 1;
      totalAge += Date.now() - new Date(update.timestamp).getTime();
    });

    rollbacks.forEach(rollback => {
      rollbacksByReason[rollback.reason] = (rollbacksByReason[rollback.reason] || 0) + 1;
    });

    return {
      totalUpdates: updates.length,
      pendingUpdates: updates.filter(u => u.applied).length,
      updatesByType,
      rollbacksByReason,
      averageUpdateAge: updates.length > 0 ? totalAge / updates.length : 0,
    };
  }

  /**
   * Clear old optimistic updates and rollbacks
   */
  async clearOldData(olderThanMinutes: number = 60): Promise<void> {
    const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);
    
    // Clear old optimistic updates
    for (const [id, update] of this.optimisticUpdates) {
      if (new Date(update.timestamp).getTime() < cutoffTime) {
        this.optimisticUpdates.delete(id);
      }
    }

    // Clear old rollback operations
    for (const [id, rollback] of this.rollbackOperations) {
      if (new Date(rollback.timestamp).getTime() < cutoffTime) {
        this.rollbackOperations.delete(id);
      }
    }

    // Trim to max sizes
    if (this.optimisticUpdates.size > this.maxUpdatesHistory) {
      const sortedUpdates = Array.from(this.optimisticUpdates.entries())
        .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      this.optimisticUpdates.clear();
      sortedUpdates.slice(0, this.maxUpdatesHistory).forEach(([id, update]) => {
        this.optimisticUpdates.set(id, update);
      });
    }

    if (this.rollbackOperations.size > this.maxRollbackHistory) {
      const sortedRollbacks = Array.from(this.rollbackOperations.entries())
        .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      this.rollbackOperations.clear();
      sortedRollbacks.slice(0, this.maxRollbackHistory).forEach(([id, rollback]) => {
        this.rollbackOperations.set(id, rollback);
      });
    }

    await Promise.all([
      this.saveOptimisticUpdates(),
      this.saveRollbackOperations(),
    ]);

    console.log('[OptimisticUpdates] Cleared old data');
  }

  /**
   * Clear all optimistic updates and rollbacks (for testing/reset)
   */
  async clearAllData(): Promise<void> {
    this.optimisticUpdates.clear();
    this.rollbackOperations.clear();
    this.syncStatusCallbacks.clear();

    await Promise.all([
      this.saveOptimisticUpdates(),
      this.saveRollbackOperations(),
    ]);

    console.log('[OptimisticUpdates] Cleared all data');
  }
}

// Singleton instance
export const optimisticUpdateService = new OptimisticUpdateService();