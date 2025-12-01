import AsyncStorage from '@react-native-async-storage/async-storage';
import { onboardingService } from '../onboarding';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('OnboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasSeenWelcome', () => {
    it('returns false when no onboarding state exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await onboardingService.hasSeenWelcome();

      expect(result).toBe(false);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('streamscribe_onboarding_state');
    });

    it('returns true when user has seen welcome', async () => {
      const mockState = {
        hasSeenWelcome: true,
        welcomeDismissedAt: '2024-01-01T00:00:00.000Z',
        onboardingVersion: 1,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

      const result = await onboardingService.hasSeenWelcome();

      expect(result).toBe(true);
    });

    it('returns false when user has not seen welcome', async () => {
      const mockState = {
        hasSeenWelcome: false,
        onboardingVersion: 1,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

      const result = await onboardingService.hasSeenWelcome();

      expect(result).toBe(false);
    });

    it('returns false when onboarding version is outdated', async () => {
      const mockState = {
        hasSeenWelcome: true,
        welcomeDismissedAt: '2024-01-01T00:00:00.000Z',
        onboardingVersion: 0, // Outdated version
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

      const result = await onboardingService.hasSeenWelcome();

      expect(result).toBe(false);
    });

    it('returns false and logs error when AsyncStorage fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await onboardingService.hasSeenWelcome();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking welcome state:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('markWelcomeSeen', () => {
    it('persists welcome dismissal with correct structure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await onboardingService.markWelcomeSeen();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'streamscribe_onboarding_state',
        expect.stringContaining('"hasSeenWelcome":true')
      );

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedState = JSON.parse(callArgs[1]);

      expect(savedState.hasSeenWelcome).toBe(true);
      expect(savedState.onboardingVersion).toBe(1);
      expect(savedState.welcomeDismissedAt).toBeDefined();
      expect(new Date(savedState.welcomeDismissedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('throws error when AsyncStorage fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(onboardingService.markWelcomeSeen()).rejects.toThrow('Storage error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error marking welcome as seen:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getOnboardingState', () => {
    it('returns null when no state exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await onboardingService.getOnboardingState();

      expect(result).toBeNull();
    });

    it('returns full onboarding state when it exists', async () => {
      const mockState = {
        hasSeenWelcome: true,
        welcomeDismissedAt: '2024-01-01T00:00:00.000Z',
        onboardingVersion: 1,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

      const result = await onboardingService.getOnboardingState();

      expect(result).toEqual(mockState);
    });

    it('returns null and logs error when AsyncStorage fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await onboardingService.getOnboardingState();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting onboarding state:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('resetOnboarding', () => {
    it('removes onboarding state from storage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await onboardingService.resetOnboarding();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('streamscribe_onboarding_state');
    });

    it('throws error when AsyncStorage fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(onboardingService.resetOnboarding()).rejects.toThrow('Storage error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resetting onboarding:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
