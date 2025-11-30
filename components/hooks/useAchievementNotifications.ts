import { useEffect, useState, useCallback } from 'react';
import { achievementNotificationsService } from '../../services/achievementNotifications';
import type { Achievement } from '../../types';

/**
 * Hook to manage achievement notification display
 * Polls the notification service queue and triggers display
 */
export function useAchievementNotifications() {
  const [bannerAchievement, setBannerAchievement] = useState<Achievement | null>(null);
  const [fullScreenAchievement, setFullScreenAchievement] = useState<Achievement | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);

  // Poll for pending notifications
  useEffect(() => {
    const checkForNotifications = async () => {
      try {
        const pendingCount = achievementNotificationsService.getPendingNotificationsCount();
        
        if (pendingCount > 0 && !isBannerVisible && !isFullScreenVisible) {
          // Load queue from storage and process
          await achievementNotificationsService.processNotificationQueue();
        }
      } catch (error) {
        console.error('Error checking for achievement notifications:', error);
      }
    };

    // Check every 2 seconds
    const interval = setInterval(checkForNotifications, 2000);

    // Check immediately on mount
    checkForNotifications();

    return () => clearInterval(interval);
  }, [isBannerVisible, isFullScreenVisible]);

  // Show banner notification
  const showBanner = useCallback((achievement: Achievement) => {
    setBannerAchievement(achievement);
    setIsBannerVisible(true);
  }, []);

  // Show full-screen notification
  const showFullScreen = useCallback((achievement: Achievement) => {
    setFullScreenAchievement(achievement);
    setIsFullScreenVisible(true);
  }, []);

  // Dismiss banner
  const dismissBanner = useCallback(() => {
    setIsBannerVisible(false);
    setTimeout(() => {
      setBannerAchievement(null);
    }, 300); // Wait for animation
  }, []);

  // Dismiss full-screen
  const dismissFullScreen = useCallback(() => {
    setIsFullScreenVisible(false);
    setTimeout(() => {
      setFullScreenAchievement(null);
    }, 300); // Wait for animation
  }, []);

  // Expand banner to full-screen
  const expandToFullScreen = useCallback(() => {
    if (bannerAchievement) {
      dismissBanner();
      setTimeout(() => {
        showFullScreen(bannerAchievement);
      }, 300);
    }
  }, [bannerAchievement, dismissBanner, showFullScreen]);

  return {
    // Banner state
    bannerAchievement,
    isBannerVisible,
    showBanner,
    dismissBanner,
    expandToFullScreen,
    
    // Full-screen state
    fullScreenAchievement,
    isFullScreenVisible,
    showFullScreen,
    dismissFullScreen,
  };
}
