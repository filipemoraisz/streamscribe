# Implementation Plan

- [x] 1. Create database schema and seed achievement data










  - Create achievements, user_achievements, achievement_progress, and achievement_notification_preferences tables with RLS policies
  - Write SQL migration file with all table definitions and indexes
  - Create seed data script with all 26 predefined achievements (viewing, streaks, completions, savings, efficiency)
  - Add database functions for automatic timestamp updates
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Add TypeScript type definitions




  - Add Achievement, UserAchievement, AchievementProgress, AchievementStats interfaces to types/index.ts
  - Add UnlockCriteria, AchievementNotificationPreferences, AchievementNotificationQueue interfaces
  - Define tier and category type unions
  - Add TIER_COLORS and ACHIEVEMENT_ICONS constant definitions
  - _Requirements: 1.1, 1.2, 9.1, 9.2, 10.1_


- [x] 3. Implement core achievements service





- [x] 3.1 Create achievements.ts service file

  - Implement getAllAchievements() to fetch from Supabase with caching
  - Implement getUserAchievements() to fetch user's unlocked achievements
  - Implement getAchievementProgress() to fetch progress toward locked achievements
  - Implement getAchievementStats() to calculate summary statistics
  - Implement caching logic using AsyncStorage for achievements definitions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_


- [x] 3.2 Implement achievement unlock logic

  - Implement checkAndUnlockAchievements() to detect new unlocks
  - Implement updateAchievementProgress() to update progress values
  - Add logic to save unlocked achievements to database
  - Add logic to update achievement_progress table
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. Implement achievement checker service






- [x] 4.1 Create achievementChecker.ts service file

  - Implement checkEpisodeAchievements() using episode_progress table
  - Implement checkStreakAchievements() using user_activity_tracking table
  - Implement checkCompletionAchievements() using show_progress table
  - Implement checkSavingsAchievements() using user_impact_stats table
  - Implement checkEfficiencyAchievements() using user_impact_stats table
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4.2 Implement helper methods for data aggregation

  - Implement getTotalEpisodesWatched() to count from episode_progress
  - Implement getCurrentStreak() to calculate from user_activity_tracking
  - Implement getTotalCompletedShows() to count from show_progress
  - Implement getTotalSavings() to fetch from user_impact_stats
  - Implement getMonthlyEfficiency() to fetch from user_impact_stats
  - _Requirements: 2.8, 3.7, 4.6, 5.7, 6.5_

- [x] 5. Implement achievement notification service





- [x] 5.1 Create achievementNotifications.ts service file


  - Implement showUnlockScreen() to display full-screen unlock modal
  - Implement showUnlockBanner() to display compact banner notification
  - Implement queueNotification() to add to notification queue
  - Implement processNotificationQueue() to display queued notifications sequentially
  - Implement notification queue manager with priority sorting
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_


- [x] 5.2 Implement push notification logic

  - Implement sendAchievementPushNotification() using existing notification service
  - Implement scheduleAchievementReminder() for progress reminders
  - Add deep linking support to achievements screen
  - Respect quiet hours from notification preferences
  - _Requirements: 7.1, 7.2, 7.5_


- [x] 5.3 Implement notification preferences management

  - Implement getNotificationPreferences() to fetch from database
  - Implement updateNotificationPreferences() to save preferences
  - Create default preferences on first access
  - Cache preferences locally for quick access
  - _Requirements: 7.1, 7.2_

- [x] 6. Create AchievementCard component






  - Create component file with props interface (achievement, userAchievement, progress, onPress)
  - Implement trophy icon rendering using Ionicons with tier-based colors
  - Implement locked/unlocked state styling (grayscale vs full color)
  - Add progress bar for locked achievements showing percentage
  - Display unlock date for unlocked achievements
  - Add tier badge (Bronze/Silver/Gold/Platinum)
  - Style with tier-specific colors from TIER_COLORS constant
  - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.8, 8.9, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_


- [x] 7. Create AchievementUnlockScreen component






  - Create full-screen modal component with semi-transparent background
  - Implement large trophy icon with scale-in bounce animation using react-native-reanimated
  - Add tier-specific background gradient
  - Implement confetti/particle animation system
  - Add achievement name with typewriter effect
  - Add description with fade-in animation
  - Implement points counter with animated counting
  - Add glow/shine effects around trophy
  - Implement sound effect playback using expo-av (optional based on preferences)
  - Implement haptic feedback using expo-haptics (optional based on preferences)
  - Add "Tap to continue" prompt with pulse animation
  - Add share button functionality
  - Implement animation sequence with precise timing (0-2000ms)
  - _Requirements: 7.1, 7.3, 7.4, 7.6, 7.7, 7.8, 8.8, 8.9, 9.2, 9.3_

- [x] 8. Create AchievementNotificationBanner component





  - Create compact banner component that slides from top
  - Display trophy icon with tier color
  - Show achievement name and tier badge
  - Implement auto-dismiss after 5 seconds
  - Add tap handler to expand to full unlock screen
  - Add swipe-up gesture to dismiss
  - Implement queue support for multiple notifications
  - _Requirements: 7.1, 7.2, 7.3, 7.5, 8.8, 8.9, 9.2_

- [x] 9. Create AchievementDetailModal component





  - Create modal component with props (achievement, userAchievement, progress, visible, onClose)
  - Display large trophy icon with tier styling
  - Show full achievement description
  - Display unlock criteria details
  - Show rarity percentage (calculate from user base)
  - Display unlock date or current progress
  - Add close button
  - _Requirements: 8.4, 9.1, 9.2, 9.3, 9.4, 9.5_


- [x] 10. Create AchievementStatsCard component




  - Create component with props (stats: AchievementStats)
  - Display total unlocked / total available
  - Show completion percentage with circular progress indicator
  - Display total points earned
  - Show tier breakdown (Bronze: X/Y, Silver: X/Y, etc.)
  - Style with appropriate colors and layout
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

- [x] 11. Create AchievementsScreen




- [x] 11.1 Create main screen component


  - Create screen file in app directory
  - Implement category tabs (All, Viewing, Streaks, Completions, Savings, Efficiency)
  - Create achievement grid layout with AchievementCard components
  - Add AchievementStatsCard at top of screen
  - Implement pull-to-refresh functionality
  - Add loading states with skeleton screens
  - Add empty state for no achievements
  - Add error state with retry button
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7_

- [x] 11.2 Implement achievement filtering and sorting


  - Implement category filter logic
  - Sort achievements by sort_order within categories
  - Separate unlocked and locked achievements
  - Show locked achievements with progress indicators
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

- [x] 11.3 Wire up data fetching and state management


  - Fetch all achievements on screen mount
  - Fetch user achievements for current user
  - Fetch achievement progress for locked achievements
  - Calculate achievement stats
  - Handle loading, error, and empty states
  - Implement cache invalidation on achievement unlock
  - _Requirements: 1.2, 1.3, 8.1, 8.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 12. Integrate achievement checks into existing services






- [x] 12.1 Add achievement hooks to progressService

  - Add achievement check call in markEpisodeWatched() method
  - Add achievement check call in updateShowProgressLocal() method
  - Trigger viewing and streak achievement checks
  - Trigger completion achievement checks when show completed
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_


- [x] 12.2 Add achievement hooks for savings and efficiency

  - Create hook to check savings achievements when user_impact_stats updates
  - Create hook to check efficiency achievements on monthly basis
  - Implement background task or trigger for periodic checks
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_


- [x] 12.3 Implement notification display logic

  - Determine display mode (full-screen vs banner) based on tier
  - Queue notifications if multiple achievements unlocked
  - Display notifications with appropriate animations
  - Mark achievements as notified after display
  - Send push notifications if enabled and app in background
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 13. Add navigation and deep linking







  - Add achievements screen to app navigation structure
  - Add tab bar icon or menu item for achievements
  - Implement deep linking from push notifications to achievements screen
  - Implement deep linking from achievement notifications to detail view
  - _Requirements: 7.5, 8.1_

- [x] 14. Create achievement settings screen


  - Create settings screen for achievement notification preferences
  - Add toggles for in-app full screen, banner, push notifications
  - Add toggles for sound, haptics, progress reminders
  - Wire up to achievementNotifications service
  - Save preferences to database
  - _Requirements: 7.1, 7.2, 7.6, 7.7, 7.8_

- [x] 15. Implement backfill script for existing users






  - Create script to calculate existing user progress
  - Check all achievement criteria against current user data
  - Unlock achievements that users have already earned
  - Insert into user_achievements table
  - Update achievement_progress for partially completed achievements
  - Run script as one-time migration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 16. Add achievement badge to profile/home screen










  - Create small badge component showing total achievements unlocked
  - Add to user profile or home screen
  - Make tappable to navigate to achievements screen
  - Show recent achievement unlock as teaser
  - _Requirements: 8.1, 10.1, 10.7_

- [x] 17. Implement offline support and sync






  - Cache achievements definitions locally
  - Cache user achievements locally
  - Queue achievement unlocks when offline
  - Sync unlocked achievements when back online
  - Handle conflicts (achievement already unlocked on server)
  - _Requirements: 1.4_

- [x] 18. Add analytics and monitoring


  - Track achievement unlock events
  - Track notification display events
  - Track user engagement with achievements screen
  - Monitor achievement unlock rates
  - Log errors in achievement checking logic
  - _Requirements: 1.1, 1.2, 7.1, 7.2_
