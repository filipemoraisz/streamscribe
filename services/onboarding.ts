import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  hasSeenWelcome: boolean;
  welcomeDismissedAt?: string;
  onboardingVersion: number;
}

class OnboardingService {
  private readonly ONBOARDING_KEY = 'streamscribe_onboarding_state';
  private readonly CURRENT_VERSION = 1;

  /**
   * Check if the user has seen the welcome message
   * @returns Promise<boolean> - true if user has seen welcome, false otherwise
   */
  async hasSeenWelcome(): Promise<boolean> {
    try {
      const stateJson = await AsyncStorage.getItem(this.ONBOARDING_KEY);
      
      if (!stateJson) {
        return false;
      }

      const state: OnboardingState = JSON.parse(stateJson);
      
      // Check if the onboarding version matches current version
      // If version is outdated, treat as not seen (for future updates)
      if (state.onboardingVersion !== this.CURRENT_VERSION) {
        return false;
      }

      return state.hasSeenWelcome;
    } catch (error) {
      console.error('Error checking welcome state:', error);
      return false;
    }
  }

  /**
   * Mark the welcome message as seen and persist the dismissal
   * @returns Promise<void>
   */
  async markWelcomeSeen(): Promise<void> {
    try {
      const state: OnboardingState = {
        hasSeenWelcome: true,
        welcomeDismissedAt: new Date().toISOString(),
        onboardingVersion: this.CURRENT_VERSION,
      };

      await AsyncStorage.setItem(this.ONBOARDING_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error marking welcome as seen:', error);
      throw error;
    }
  }

  /**
   * Get the full onboarding state
   * @returns Promise<OnboardingState | null>
   */
  async getOnboardingState(): Promise<OnboardingState | null> {
    try {
      const stateJson = await AsyncStorage.getItem(this.ONBOARDING_KEY);
      
      if (!stateJson) {
        return null;
      }

      return JSON.parse(stateJson);
    } catch (error) {
      console.error('Error getting onboarding state:', error);
      return null;
    }
  }

  /**
   * Reset onboarding state (useful for testing or version updates)
   * @returns Promise<void>
   */
  async resetOnboarding(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.ONBOARDING_KEY);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  }
}

export const onboardingService = new OnboardingService();
