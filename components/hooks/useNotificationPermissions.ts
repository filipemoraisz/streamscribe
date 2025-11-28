import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { notificationManager } from '../../services';
import { notificationPermissionService } from '../../services/notificationPermissions';

export interface NotificationPermissionState {
  hasPermission: boolean;
  shouldShowPrompt: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface NotificationPermissionActions {
  requestPermission: () => Promise<boolean>;
  dismissPrompt: () => void;
  checkPermissions: () => Promise<void>;
  resetPermissionState: () => Promise<void>;
}

export function useNotificationPermissions(): [NotificationPermissionState, NotificationPermissionActions] {
  const [state, setState] = useState<NotificationPermissionState>({
    hasPermission: false,
    shouldShowPrompt: false,
    isLoading: true,
    error: null,
  });

  const checkPermissions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const hasPermission = await notificationManager.requestPermissions();
      const shouldShowPrompt = await notificationPermissionService.shouldShowPermissionPrompt();
      
      setState(prev => ({
        ...prev,
        hasPermission,
        shouldShowPrompt: !hasPermission && shouldShowPrompt,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Record that we asked for permission
      await notificationPermissionService.recordPermissionAsked();
      
      const granted = await notificationManager.requestPermissions();
      
      if (granted) {
        await notificationPermissionService.recordPermissionGranted();
        await notificationManager.registerForPushNotifications();
        
        setState(prev => ({
          ...prev,
          hasPermission: true,
          shouldShowPrompt: false,
          isLoading: false,
        }));
      } else {
        await notificationPermissionService.recordPermissionDenied();
        
        setState(prev => ({
          ...prev,
          hasPermission: false,
          shouldShowPrompt: false,
          isLoading: false,
        }));
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      return false;
    }
  }, []);

  const dismissPrompt = useCallback(async () => {
    try {
      await notificationPermissionService.recordPermissionDenied();
      setState(prev => ({ ...prev, shouldShowPrompt: false }));
    } catch (error) {
      console.error('Error dismissing permission prompt:', error);
    }
  }, []);

  const resetPermissionState = useCallback(async () => {
    try {
      await notificationPermissionService.resetPermissionState();
      await checkPermissions();
    } catch (error) {
      console.error('Error resetting permission state:', error);
    }
  }, [checkPermissions]);

  // Check permissions on mount and when app becomes active
  useEffect(() => {
    checkPermissions();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check if permissions changed while app was in background
        checkPermissions();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [checkPermissions]);

  return [
    state,
    {
      requestPermission,
      dismissPrompt,
      checkPermissions,
      resetPermissionState,
    },
  ];
}

// Hook for components that want to show permission prompt at appropriate times
export function useNotificationPromptTrigger(
  appOpenCount: number = 0,
  daysActive: number = 0
) {
  const [permissionState, permissionActions] = useNotificationPermissions();
  const [shouldTriggerPrompt, setShouldTriggerPrompt] = useState(false);

  useEffect(() => {
    const checkShouldPrompt = async () => {
      if (permissionState.hasPermission || permissionState.isLoading) {
        return;
      }

      try {
        const shouldPrompt = await notificationPermissionService.shouldPromptBasedOnUsage(
          appOpenCount,
          daysActive
        );
        setShouldTriggerPrompt(shouldPrompt);
      } catch (error) {
        console.error('Error checking if should trigger prompt:', error);
      }
    };

    checkShouldPrompt();
  }, [permissionState.hasPermission, permissionState.isLoading, appOpenCount, daysActive]);

  const triggerPrompt = useCallback(() => {
    setShouldTriggerPrompt(true);
  }, []);

  const dismissTrigger = useCallback(() => {
    setShouldTriggerPrompt(false);
    permissionActions.dismissPrompt();
  }, [permissionActions]);

  return {
    shouldShowPrompt: shouldTriggerPrompt && permissionState.shouldShowPrompt,
    triggerPrompt,
    dismissTrigger,
    permissionState,
    permissionActions,
  };
}