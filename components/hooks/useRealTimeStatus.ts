import { useState, useEffect, useCallback } from 'react';
import { realTimeManager } from '../../services/realtime';
import { ConnectionState, QueueStatus } from '../../types';

export interface RealTimeStatus {
  isConnected: boolean;
  isConnecting: boolean;
  pendingActions: number;
  lastSyncTime?: string;
  reconnectAttempts: number;
  isNetworkAvailable: boolean;
}

/**
 * Hook for managing real-time connection status
 * 
 * Provides reactive state for connection status, sync queue, and network state.
 * Automatically subscribes to real-time manager events.
 */
export function useRealTimeStatus(): RealTimeStatus {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
  });
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pendingActions: 0,
    lastSyncTime: '',
    isProcessing: false,
    errors: [],
  });
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true);

  // Update connection state
  const handleConnectionChange = useCallback((connected: boolean) => {
    setConnectionState(prev => ({
      ...prev,
      isConnected: connected,
      isConnecting: false,
      lastConnected: connected ? new Date().toISOString() : prev.lastConnected,
    }));
  }, []);

  // Refresh status from real-time manager
  const refreshStatus = useCallback(() => {
    const currentConnectionState = realTimeManager.getConnectionState();
    const currentQueueStatus = realTimeManager.getQueueStatus();
    const networkStatus = realTimeManager.isNetworkConnected();

    setConnectionState(currentConnectionState);
    setQueueStatus(currentQueueStatus);
    setIsNetworkAvailable(networkStatus);
  }, []);

  useEffect(() => {
    // Subscribe to connection changes
    realTimeManager.onConnectionChange(handleConnectionChange);

    // Get initial status
    refreshStatus();

    // Set up periodic status refresh
    const statusInterval = setInterval(refreshStatus, 5000); // Every 5 seconds

    return () => {
      clearInterval(statusInterval);
      // Note: We don't unsubscribe from connection changes as the manager
      // doesn't provide an unsubscribe method. This is acceptable since
      // the manager is a singleton and callbacks are lightweight.
    };
  }, [handleConnectionChange, refreshStatus]);

  return {
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    pendingActions: queueStatus.pendingActions,
    lastSyncTime: connectionState.lastConnected || queueStatus.lastSyncTime,
    reconnectAttempts: connectionState.reconnectAttempts,
    isNetworkAvailable,
  };
}

/**
 * Hook for managing sync status with manual refresh capability
 */
export function useSyncStatus() {
  const realTimeStatus = useRealTimeStatus();
  
  const forceSync = useCallback(async () => {
    if (realTimeStatus.isConnected) {
      await realTimeManager.processSyncQueue();
    }
  }, [realTimeStatus.isConnected]);

  const forceReconnect = useCallback(() => {
    realTimeManager.forceReconnect();
  }, []);

  return {
    ...realTimeStatus,
    forceSync,
    forceReconnect,
    canSync: realTimeStatus.isConnected && realTimeStatus.isNetworkAvailable,
  };
}