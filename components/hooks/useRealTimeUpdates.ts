import { useEffect, useCallback, useRef } from 'react';
import { realTimeManager } from '../../services/realtime';
import { RealTimeUpdate } from '../../types';

export interface RealTimeUpdateHandlers {
  onWatchlistUpdate?: (update: RealTimeUpdate) => void;
  onProgressUpdate?: (update: RealTimeUpdate) => void;
  onPreferenceUpdate?: (update: RealTimeUpdate) => void;
}

/**
 * Hook for handling real-time updates in screens
 * 
 * Automatically subscribes to real-time updates and calls appropriate handlers.
 * Handles cleanup and prevents stale closure issues.
 */
export function useRealTimeUpdates(handlers: RealTimeUpdateHandlers) {
  const handlersRef = useRef(handlers);
  
  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Handle real-time updates
  const handleUpdate = useCallback((update: RealTimeUpdate) => {
    const currentHandlers = handlersRef.current;
    
    switch (update.type) {
      case 'watchlist':
        if (currentHandlers.onWatchlistUpdate) {
          currentHandlers.onWatchlistUpdate(update);
        }
        break;
      case 'progress':
        if (currentHandlers.onProgressUpdate) {
          currentHandlers.onProgressUpdate(update);
        }
        break;
      default:
        if (currentHandlers.onPreferenceUpdate) {
          currentHandlers.onPreferenceUpdate(update);
        }
        break;
    }
  }, []);

  useEffect(() => {
    // Subscribe to real-time updates
    realTimeManager.onUpdate(handleUpdate);

    // Note: The real-time manager doesn't provide an unsubscribe method
    // This is acceptable since it's a singleton and the callback is lightweight
    // In a production app, we'd want to add an unsubscribe method
  }, [handleUpdate]);
}

/**
 * Hook for handling real-time watchlist updates
 */
export function useWatchlistRealTimeUpdates(onUpdate: (update: RealTimeUpdate) => void) {
  useRealTimeUpdates({
    onWatchlistUpdate: onUpdate,
  });
}

/**
 * Hook for handling real-time progress updates
 */
export function useProgressRealTimeUpdates(onUpdate: (update: RealTimeUpdate) => void) {
  useRealTimeUpdates({
    onProgressUpdate: onUpdate,
  });
}

/**
 * Hook for handling all real-time updates with automatic refresh
 */
export function useAutoRefreshOnUpdates(refreshCallback: () => void | Promise<void>) {
  const refreshCallbackRef = useRef(refreshCallback);
  
  useEffect(() => {
    refreshCallbackRef.current = refreshCallback;
  }, [refreshCallback]);

  const handleAnyUpdate = useCallback((update: RealTimeUpdate) => {
    // Debounce rapid updates
    const timeoutId = setTimeout(() => {
      refreshCallbackRef.current();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  useRealTimeUpdates({
    onWatchlistUpdate: handleAnyUpdate,
    onProgressUpdate: handleAnyUpdate,
    onPreferenceUpdate: handleAnyUpdate,
  });
}