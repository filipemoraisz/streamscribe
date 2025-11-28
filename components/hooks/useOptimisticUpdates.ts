import { useState, useEffect, useCallback } from 'react';
import { realTimeManager } from '../../services/realtime';
import { SyncStatusFeedback } from '../../services/optimisticUpdates';

export interface OptimisticUpdateHookResult {
  // State
  isSyncing: boolean;
  syncProgress: number;
  syncStatus: 'idle' | 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  syncMessage: string;
  
  // Actions
  updateProgressWithOptimisticUI: (
    showId: number,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    currentProgress?: any
  ) => Promise<void>;
  
  updateWatchlistWithOptimisticUI: (
    itemId: number,
    operation: 'add' | 'remove' | 'update',
    itemData?: any,
    currentWatchlist?: any[]
  ) => Promise<void>;
  
  // Utilities
  clearSyncStatus: () => void;
}

export function useOptimisticUpdates(): OptimisticUpdateHookResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pending' | 'syncing' | 'success' | 'failed' | 'conflict'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [activeActionIds, setActiveActionIds] = useState<Set<string>>(new Set());

  // Handle sync status updates
  const handleSyncStatusUpdate = useCallback((status: SyncStatusFeedback) => {
    setSyncStatus(status.status);
    setSyncMessage(status.message);
    setSyncProgress(status.progress || 0);
    
    setIsSyncing(status.status === 'pending' || status.status === 'syncing');
    
    // Remove action ID when sync completes (success or failure)
    if (status.status === 'success' || status.status === 'failed') {
      setActiveActionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(status.actionId);
        return newSet;
      });
      
      // Clear status after a delay for success
      if (status.status === 'success') {
        setTimeout(() => {
          setSyncStatus('idle');
          setSyncMessage('');
          setSyncProgress(0);
          setIsSyncing(false);
        }, 2000);
      }
    }
  }, []);

  // Update progress with optimistic UI
  const updateProgressWithOptimisticUI = useCallback(async (
    showId: number,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    currentProgress?: any
  ) => {
    try {
      // Get current user
      const { data: { user } } = await import('../../services/supabase').then(m => m.supabase.auth.getUser());
      if (!user) {
        throw new Error('User not authenticated');
      }

      const originalData = currentProgress || {
        showId,
        seasonNumber,
        episodeNumber,
        watched: false,
        watchedDate: null,
      };

      const optimisticData = {
        ...originalData,
        watched,
        watchedDate: watched ? new Date().toISOString() : null,
      };

      const payload = {
        userId: user.id,
        showId,
        seasonNumber,
        episodeNumber,
        watched,
        watchedDate: optimisticData.watchedDate,
      };

      const result = await realTimeManager.queueProgressUpdateWithOptimisticUI(
        payload,
        originalData,
        optimisticData
      );

      // Register for status updates
      setActiveActionIds(prev => new Set(prev).add(result.actionId));
      realTimeManager.onSyncStatusChange(result.actionId, handleSyncStatusUpdate);

      console.log(`[useOptimisticUpdates] Queued progress update with optimistic UI: ${result.actionId}`);

    } catch (error) {
      console.error('[useOptimisticUpdates] Failed to update progress:', error);
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Failed to update progress');
      setIsSyncing(false);
    }
  }, [handleSyncStatusUpdate]);

  // Update watchlist with optimistic UI
  const updateWatchlistWithOptimisticUI = useCallback(async (
    itemId: number,
    operation: 'add' | 'remove' | 'update',
    itemData?: any,
    currentWatchlist?: any[]
  ) => {
    try {
      // Get current user
      const { data: { user } } = await import('../../services/supabase').then(m => m.supabase.auth.getUser());
      if (!user) {
        throw new Error('User not authenticated');
      }

      const originalData = currentWatchlist || [];
      
      let optimisticData = [...originalData];
      
      switch (operation) {
        case 'add':
          if (!optimisticData.find(item => item.id === itemId)) {
            optimisticData.push({
              id: itemId,
              ...itemData,
              added_date: new Date().toISOString(),
            });
          }
          break;
        case 'remove':
          optimisticData = optimisticData.filter(item => item.id !== itemId);
          break;
        case 'update':
          const index = optimisticData.findIndex(item => item.id === itemId);
          if (index !== -1) {
            optimisticData[index] = { ...optimisticData[index], ...itemData };
          }
          break;
      }

      const payload = {
        userId: user.id,
        itemId,
        operation,
        itemData,
      };

      const result = await realTimeManager.queueWatchlistUpdateWithOptimisticUI(
        payload,
        originalData,
        optimisticData
      );

      // Register for status updates
      setActiveActionIds(prev => new Set(prev).add(result.actionId));
      realTimeManager.onSyncStatusChange(result.actionId, handleSyncStatusUpdate);

      console.log(`[useOptimisticUpdates] Queued watchlist update with optimistic UI: ${result.actionId}`);

    } catch (error) {
      console.error('[useOptimisticUpdates] Failed to update watchlist:', error);
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Failed to update watchlist');
      setIsSyncing(false);
    }
  }, [handleSyncStatusUpdate]);

  // Clear sync status
  const clearSyncStatus = useCallback(() => {
    setSyncStatus('idle');
    setSyncMessage('');
    setSyncProgress(0);
    setIsSyncing(false);
    
    // Unregister all active action callbacks
    activeActionIds.forEach(actionId => {
      realTimeManager.offSyncStatusChange(actionId);
    });
    setActiveActionIds(new Set());
  }, [activeActionIds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeActionIds.forEach(actionId => {
        realTimeManager.offSyncStatusChange(actionId);
      });
    };
  }, [activeActionIds]);

  return {
    // State
    isSyncing,
    syncProgress,
    syncStatus,
    syncMessage,
    
    // Actions
    updateProgressWithOptimisticUI,
    updateWatchlistWithOptimisticUI,
    
    // Utilities
    clearSyncStatus,
  };
}