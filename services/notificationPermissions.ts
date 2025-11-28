import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationManager } from './notifications';

interface PermissionState {
  hasAsked: boolean;
  lastAskedDate: string;
  deniedCount: number;
  permanentlyDenied: boolean;
}

export class NotificationPermissionService {
  private readonly PERMISSION_STATE_KEY = 'notification_permission_state';
  private readonly REPROMPT_DELAY_DAYS = 7; // Wait 7 days before re-prompting
  private readonly MAX_PROMPTS = 3; // Maximum number of times to prompt

  async shouldShowPermissionPrompt(): Promise<boolean> {
    try {
      // Check if notifications are already granted
      const hasPermission = await this.checkCurrentPermissions();
      if (hasPermission) {
        return false;
      }

      const state = await this.getPermissionState();
      
      // Don't prompt if permanently denied or max prompts reached
      if (state.permanentlyDenied || state.deniedCount >= this.MAX_PROMPTS) {
        return false;
      }

      // Don't prompt if we've asked recently
      if (state.hasAsked) {
        const daysSinceLastAsk = this.getDaysSince(state.lastAskedDate);
        if (daysSinceLastAsk < this.REPROMPT_DELAY_DAYS) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking if should show permission prompt:', error);
      return false;
    }
  }

  async recordPermissionAsked(): Promise<void> {
    try {
      const state = await this.getPermissionState();
      const newState: PermissionState = {
        ...state,
        hasAsked: true,
        lastAskedDate: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(this.PERMISSION_STATE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Error recording permission asked:', error);
    }
  }

  async recordPermissionDenied(): Promise<void> {
    try {
      const state = await this.getPermissionState();
      const newState: PermissionState = {
        ...state,
        hasAsked: true,
        lastAskedDate: new Date().toISOString(),
        deniedCount: state.deniedCount + 1,
        permanentlyDenied: state.deniedCount + 1 >= this.MAX_PROMPTS,
      };
      
      await AsyncStorage.setItem(this.PERMISSION_STATE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Error recording permission denied:', error);
    }
  }

  async recordPermissionGranted(): Promise<void> {
    try {
      // Clear the permission state since we have permission now
      await AsyncStorage.removeItem(this.PERMISSION_STATE_KEY);
    } catch (error) {
      console.error('Error recording permission granted:', error);
    }
  }

  async resetPermissionState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.PERMISSION_STATE_KEY);
    } catch (error) {
      console.error('Error resetting permission state:', error);
    }
  }

  private async checkCurrentPermissions(): Promise<boolean> {
    try {
      return await notificationManager.requestPermissions();
    } catch (error) {
      console.error('Error checking current permissions:', error);
      return false;
    }
  }

  private async getPermissionState(): Promise<PermissionState> {
    try {
      const stateJson = await AsyncStorage.getItem(this.PERMISSION_STATE_KEY);
      if (stateJson) {
        return JSON.parse(stateJson);
      }
    } catch (error) {
      console.error('Error getting permission state:', error);
    }

    // Return default state
    return {
      hasAsked: false,
      lastAskedDate: '',
      deniedCount: 0,
      permanentlyDenied: false,
    };
  }

  private getDaysSince(dateString: string): number {
    if (!dateString) return Infinity;
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  // Utility method to check if user should be re-prompted based on app usage
  async shouldPromptBasedOnUsage(appOpenCount: number, daysActive: number): Promise<boolean> {
    try {
      const shouldShow = await this.shouldShowPermissionPrompt();
      if (!shouldShow) return false;

      // Only prompt engaged users (opened app at least 3 times or been active for 3+ days)
      return appOpenCount >= 3 || daysActive >= 3;
    } catch (error) {
      console.error('Error checking usage-based prompting:', error);
      return false;
    }
  }

  // Method to handle system permission changes (user enables in settings)
  async handleSystemPermissionChange(granted: boolean): Promise<void> {
    if (granted) {
      await this.recordPermissionGranted();
      // Initialize notification manager if not already done
      try {
        await notificationManager.initialize();
        await notificationManager.registerForPushNotifications();
      } catch (error) {
        console.error('Error initializing notifications after permission grant:', error);
      }
    }
  }
}

export const notificationPermissionService = new NotificationPermissionService();