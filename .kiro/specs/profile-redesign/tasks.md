# Implementation Plan

- [x] 1. Set up project structure and core interfaces



  - Create `services/userActivity.ts` service file
  - Define TypeScript interfaces in `types/index.ts` for UserStats, UserActivityTracking
  - Create `components/profile/` directory for profile-specific components
  - _Requirements: 1.1, 2.1, 8.1_

- [x] 2. Implement UserActivityService



  - [x] 2.1 Create userActivityService class with getUserStats method

    - Query user_activity_tracking table for streak and activity data (NEW - table exists but no code)
    - Use existing progressService to get show completion count
    - Use existing progressService to get episode watch count
    - Use existing achievementsService to get total points
    - Combine data into UserStats interface
    - _Requirements: 2.1, 2.2_
    - _Note: Leverages existing services where possible, only adds new activity tracking queries_

  - [x] 2.2 Implement caching layer for user stats

    - Cache stats in AsyncStorage with 5-minute TTL
    - Implement getCachedUserStats and cacheUserStats methods
    - Add background refresh on app focus
    - _Requirements: 2.3_


  - [x] 2.3 Create updateStreak method

    - Call Supabase function update_user_streak
    - Handle streak calculation logic
    - Update local cache optimistically
    - _Requirements: 2.2, 3.3_


  - [x] 2.4 Add initializeUserActivity method

    - Create user_activity_tracking record for new users
    - Set default values for all fields
    - Handle errors gracefully
    - _Requirements: 2.1_

- [x] 3. Create StatsGrid component




  - [x] 3.1 Build base StatsGrid layout component

    - Create 2x2 grid layout with flexbox
    - Implement responsive sizing (48% width per card)
    - Add gap spacing (12px)
    - Style with dark surface background
    - _Requirements: 1.1, 1.3, 8.1_

  - [x] 3.2 Create StreakCard component

    - Display current streak with flame icon
    - Show longest streak as secondary text
    - Apply orange gradient background
    - Add flame flicker animation
    - _Requirements: 2.2, 2.5, 6.1_


  - [x] 3.3 Create EpisodesCard component

    - Display total episodes watched
    - Use play-circle icon
    - Implement counter animation
    - Style with dark surface and orange accent
    - _Requirements: 2.1, 2.3_



  - [x] 3.4 Create ShowsCard component

    - Display shows completed count
    - Use TV icon
    - Implement counter animation
    - Style with dark surface and orange accent
    - _Requirements: 2.1, 2.3_




  - [x] 3.5 Create PointsCard component




    - Display achievement points total
    - Use star icon
    - Implement counter animation
    - Style with dark surface and orange accent
    - _Requirements: 3.1, 3.2_

  - [x] 3.6 Add loading skeleton states for StatsGrid






    - Create skeleton placeholder components
    - Show while data is loading
    - Match card dimensions and layout
    - _Requirements: 2.3_

- [x] 4. Enhance ProfileHeader component





  - [x] 4.1 Update avatar styling with orange glow


    - Increase avatar size to 120x120
    - Add orange shadow (shadowColor: #FF6600, shadowRadius: 20)
    - Implement subtle pulse animation on mount
    - _Requirements: 1.2, 5.1, 5.2, 6.1_

  - [x] 4.2 Implement parallax scroll effect


    - Use useSharedValue for scroll position
    - Scale avatar down on scroll (1.0 → 0.8)
    - Translate avatar up on scroll
    - Fade out on scroll
    - _Requirements: 6.1, 6.2_


  - [x] 4.3 Update typography for bold design

    - Increase name font size to 32px, weight 700
    - Style email with muted color (#888888)
    - Add proper spacing between elements
    - _Requirements: 1.3, 7.3_

- [x] 5. Create QuickActionsGrid component






  - [x] 5.1 Build 2x2 grid layout for quick actions

    - Create grid with 4 action cards
    - Implement equal sizing and spacing
    - Add dark surface background
    - _Requirements: 4.1, 4.2, 8.1_


  - [x] 5.2 Create QuickActionCard component

    - Display large icon (32px) in orange
    - Show label below icon
    - Add press state with orange border
    - Implement haptic feedback on press
    - _Requirements: 4.1, 4.4, 6.3_


  - [x] 5.3 Wire up navigation for quick actions

    - Notification Settings → /notification-settings
    - Achievement Settings → /achievement-settings
    - Connection Test → /connection-test
    - Viewing History → placeholder for future
    - _Requirements: 4.2, 4.3_

  - [ ]* 5.4 Add optional badge indicators
    - Show notification count badge
    - Style with orange background
    - Position in top-right corner
    - _Requirements: 4.5_

- [x] 6. Enhance AchievementShowcase section




  - [x] 6.1 Integrate existing AchievementStatsCard


    - Import and use existing component
    - Ensure proper data flow from achievementsService
    - Add refresh capability
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Create FeaturedAchievements component


    - Build horizontal scrollable list
    - Show recent unlocks (last 3)
    - Show close to unlock (>75% progress)
    - Implement snap scrolling
    - _Requirements: 3.1, 3.4_

  - [x] 6.3 Create FeaturedAchievementCard component


    - Display achievement icon and name
    - Show progress bar for locked achievements
    - Display points value
    - Add press handler to view details
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 7. Implement animations and interactions





  - [x] 7.1 Add staggered fade-in for cards

    - Use withDelay for sequential animations
    - Stagger by 100ms per card
    - Use cubic easing for smooth effect
    - _Requirements: 6.2_

  - [x] 7.2 Implement counter animations for stats

    - Animate numbers from 0 to target value
    - Use 1-second duration with easing
    - Apply to episodes, shows, and points cards
    - _Requirements: 2.3, 6.2_

  - [x] 7.3 Create flame flicker animation for streak

    - Use withRepeat for infinite loop
    - Scale between 0.95 and 1.1
    - 300ms per cycle
    - _Requirements: 2.5, 6.1_

  - [x] 7.4 Add haptic feedback to interactions


    - Light impact on card press
    - Medium impact on quick action press
    - Success haptic on profile save
    - _Requirements: 6.3_

  - [x] 7.5 Implement pull-to-refresh

    - Add RefreshControl to ScrollView
    - Clear caches and reload data
    - Show orange loading indicator
    - _Requirements: 6.5_

- [x] 8. Update main ProfileScreen




  - [x] 8.1 Integrate new components into profile layout

    - Add StatsGrid below ProfileHeader
    - Add AchievementShowcase below StatsGrid
    - Add QuickActionsGrid below AchievementShowcase
    - Maintain existing PersonalInformation section
    - _Requirements: 1.1, 1.3, 8.1_


  - [x] 8.2 Implement data loading logic
    - Load user data from AuthContext
    - Load stats from userActivityService
    - Load achievements from achievementsService
    - Handle loading states
    - _Requirements: 2.1, 2.2_

  - [x] 8.3 Add error handling and empty states

    - Show error message if data fails to load
    - Display empty state for new users
    - Provide retry button on errors
    - _Requirements: 2.1_


  - [x] 8.4 Implement scroll animations

    - Set up useSharedValue for scroll position
    - Apply parallax to header
    - Apply blur to sticky header
    - _Requirements: 6.1, 6.2_

- [x] 9. Database integration and migrations





  - [x] 9.1 Run add_streak_and_impact_stats.sql migration


    - Execute in Supabase SQL Editor
    - Verify columns added successfully
    - Test update_user_streak function
    - _Requirements: 2.2, 2.5_

  - [x] 9.2 Create database helper functions


    - Add RPC calls for streak updates
    - Add queries for stats aggregation
    - Implement error handling
    - _Requirements: 2.1, 2.2_

  - [x] 9.3 Integrate streak tracking with episode watching


    - Call updateStreak when episode marked as watched
    - Update in progressService.markEpisodeWatched
    - Handle offline scenarios
    - _Requirements: 2.2, 2.5_

- [ ] 10. Polish and optimization
  - [ ] 10.1 Optimize performance
    - Implement data caching strategy
    - Use React.memo for expensive components
    - Debounce scroll events
    - Lazy load images
    - _Requirements: 8.1, 8.2_

  - [ ] 10.2 Add accessibility features
    - Add accessibilityLabel to all interactive elements
    - Ensure proper accessibilityRole
    - Test with screen reader
    - Verify color contrast ratios
    - _Requirements: 8.1_

  - [ ] 10.3 Implement responsive layout adjustments
    - Test on different screen sizes
    - Adjust grid layouts for tablets
    - Handle orientation changes
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 10.4 Add analytics tracking
    - Track profile views
    - Track quick action usage
    - Track achievement interactions
    - _Requirements: 2.1_

- [ ] 11. Testing and validation
  - [ ]* 11.1 Write unit tests for userActivityService
    - Test getUserStats method
    - Test updateStreak method
    - Test caching logic
    - Test error handling
    - _Requirements: 2.1, 2.2_

  - [ ]* 11.2 Write component tests
    - Test StatsGrid rendering
    - Test QuickActionsGrid navigation
    - Test animations trigger correctly
    - Test loading states
    - _Requirements: 1.1, 2.1_

  - [ ]* 11.3 Perform integration testing
    - Test full profile load flow
    - Test streak update after watching episode
    - Test pull-to-refresh
    - Test navigation to settings
    - _Requirements: 2.1, 2.2, 4.2_

  - [ ] 11.4 Manual testing and QA
    - Test on iOS device
    - Test on Android device
    - Verify animations are smooth
    - Check for memory leaks
    - Validate data accuracy
    - _Requirements: 1.1, 2.1, 6.1_
