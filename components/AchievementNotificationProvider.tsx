import React, { useEffect, useState } from 'react';
import { achievementNotificationsService } from '../services/achievementNotifications';
import { AchievementNotificationBanner } from './AchievementNotificationBanner';
import { AchievementUnlockScreen } from './AchievementUnlockScreen';
import type { Achievement, AchievementNotificationPreferences } from '../types';

/**
 * Provider component that manages achievement notification display
 * Integrates with the achievement notification service queue
 */
export const AchievementNotificationProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [bannerAchievement, setBannerAchievement] = useState<Achievement | null>(null);
  const [fullScreenAchievement, setFullScreenAchievement] = useState<Achievement | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  const [preferences, setPreferences] = useState<AchievementNotificationPreferences | null>(null);

  // Load preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await achievementNotificationsService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading achievement notification preferences:', error);
    }
  };

  // Poll for pending notifications
  useEffect(() => {
    const checkForNotifications = async () => {
      try {
        // Don't check if already showing a notification
        if (isBannerVisible || isFullScreenVisible) {
          console.log('[AchievementProvider] Skipping check - notification already visible');
          return;
        }

        const pendingCount = achievementNotificationsService.getPendingNotificationsCount();
        console.log(`[AchievementProvider] Pending notifications: ${pendingCount}`);
        
        if (pendingCount > 0) {
          // Get the notification queue (we'll need to expose this in the service)
          // For now, we'll trigger processing which will handle display
          await processNextNotification();
        }
      } catch (error) {
        console.error('[AchievementProvider] Error checking for achievement notifications:', error);
      }
    };

    // Check every 2 seconds
    const interval = setInterval(checkForNotifications, 2000);

    // Check immediately on mount
    checkForNotifications();

    return () => clearInterval(interval);
  }, [isBannerVisible, isFullScreenVisible]);

  const processNextNotification = async () => {
    try {
      // This is a workaround - ideally the service would expose the queue
      // For now, we'll manually check the queue from AsyncStorage
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const queueJson = await AsyncStorage.getItem('@achievement_notification_queue');
      
      console.log('[AchievementProvider] Queue JSON:', queueJson);
      
      if (!queueJson) {
        console.log('[AchievementProvider] No queue found in storage');
        return;
      }
      
      const queue = JSON.parse(queueJson);
      console.log('[AchievementProvider] Queue length:', queue.length);
      
      const pendingNotifications = queue.filter((n: any) => !n.displayed);
      console.log('[AchievementProvider] Pending (undisplayed) notifications:', pendingNotifications.length);
      
      if (pendingNotifications.length === 0) {
        console.log('[AchievementProvider] No pending notifications to display');
        return;
      }
      
      const notification = pendingNotifications[0];
      const achievement = notification.achievement;
      
      console.log(`[AchievementProvider] Displaying ${notification.displayMode} notification for: ${achievement.name}`);
      
      // Show based on display mode
      if (notification.displayMode === 'full_screen') {
        setFullScreenAchievement(achievement);
        setIsFullScreenVisible(true);
      } else {
        setBannerAchievement(achievement);
        setIsBannerVisible(true);
      }
      
      // Mark as displayed after showing
      await achievementNotificationsService.markNotificationAsDisplayed(notification.id);
      console.log(`[AchievementProvider] Notification ${notification.id} marked as displayed`);
    } catch (error) {
      console.error('[AchievementProvider] Error processing notification:', error);
    }
  };

  const handleBannerDismiss = () => {
    setIsBannerVisible(false);
    setTimeout(() => {
      setBannerAchievement(null);
    }, 300);
  };

  const handleBannerPress = () => {
    // Expand banner to full-screen
    if (bannerAchievement) {
      handleBannerDismiss();
      setTimeout(() => {
        setFullScreenAchievement(bannerAchievement);
        setIsFullScreenVisible(true);
      }, 300);
    }
  };

  const handleFullScreenClose = () => {
    setIsFullScreenVisible(false);
    setTimeout(() => {
      setFullScreenAchievement(null);
    }, 300);
  };

  return (
    <>
      {children}
      
      {/* Banner Notification */}
      <AchievementNotificationBanner
        achievement={bannerAchievement}
        visible={isBannerVisible}
        onDismiss={handleBannerDismiss}
        onPress={handleBannerPress}
      />

      {/* Full-Screen Notification */}
      {fullScreenAchievement && (
        <AchievementUnlockScreen
          achievement={fullScreenAchievement}
          visible={isFullScreenVisible}
          onClose={handleFullScreenClose}
          preferences={preferences || undefined}
        />
      )}
    </>
  );
};
