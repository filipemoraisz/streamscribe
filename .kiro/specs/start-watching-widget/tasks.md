# Implementation Plan

- [x] 1. Set up project structure and core interfaces





  - Create directory structure for components and services
  - Define TypeScript interfaces for RecommendationItem, TasteProfile, and service contracts
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implement TasteProfileService






  - [x] 2.1 Create buildTasteProfile method with database queries

    - Query user_activity table for watched content
    - Query watchlist for ratings and preferences
    - Analyze genres, content types, and viewing patterns
    - Calculate preference scores and return TasteProfile
    - _Requirements: 3.4, 3.5_


  - [x] 2.2 Create generateTasteRecommendations method

    - Query TMDB API based on top genres from profile
    - Filter results by subscribed streaming services
    - Exclude dismissed and watched items
    - Score each recommendation using calculateTasteScore
    - _Requirements: 3.6, 3.7_

  - [x] 2.3 Implement calculateTasteScore algorithm

    - Calculate genre match score (40% weight)
    - Calculate rating similarity score (30% weight)
    - Calculate content type preference score (20% weight)
    - Calculate recency score (10% weight)
    - Return combined 0-100 score
    - _Requirements: 3.6_

- [x] 3. Implement RecommendationQueueService



  - [x] 3.1 Create queue initialization logic

    - Fetch unwatched watchlist items from database
    - Filter by user's subscribed services
    - Shuffle items for variety
    - Return first 3 items for initial display
    - _Requirements: 2.1, 2.6_


  - [x] 3.2 Implement getNextRecommendation method

    - Check current phase (watchlist vs taste)
    - Return next item from appropriate queue
    - Handle phase transition when watchlist exhausted
    - Refill taste queue when needed
    - _Requirements: 2.2, 3.2, 3.3_

  - [x] 3.3 Create queue management utilities


    - Implement refillTasteQueue method
    - Add shouldTransitionToTaste check
    - Handle queue state persistence
    - _Requirements: 2.5, 3.8_

- [x] 4. Implement SwipeActionService





  - [x] 4.1 Create markAsWatched action handler


    - For TV shows: call progressService.markEpisodeWatched(id, 1, 1)
    - For movies: call storageService.markAsWatched(item)
    - Log action for analytics
    - Handle errors with retry logic
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 4.2 Create dismissRecommendation action handler

    - Track dismissed item ID in local state
    - Log action for analytics
    - No backend persistence needed
    - _Requirements: 5.3, 5.5_


  - [x] 4.3 Create removeFromWatchlist action handler

    - Call storageService.removeFromWatchlist(id, type)
    - Log action for analytics
    - Trigger watchlist update event
    - _Requirements: 5.4, 5.5, 5.9_



  - [x] 4.4 Implement error handling and retry logic

    - Add exponential backoff for failed requests
    - Implement rollback mechanism for failed actions
    - Show user-friendly error messages
    - _Requirements: 5.6, 8.1, 8.2_

- [x] 5. Create SwipeableCard component






  - [x] 5.1 Set up gesture handling with PanGestureHandler

    - Install and configure react-native-gesture-handler
    - Create PanGestureHandler for each card
    - Define swipe thresholds (horizontal: 120px, vertical: 100px, velocity: 0.3)
    - Track gesture state (idle, dragging, returning, exiting)
    - _Requirements: 1.1, 1.4, 1.7_


  - [x] 5.2 Implement swipe direction detection

    - Calculate swipe direction from gesture translation
    - Determine if swipe meets threshold requirements
    - Check velocity for quick swipes
    - Trigger appropriate action callback
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.3 Create card drag animations

    - Animate translateX and translateY based on gesture
    - Add subtle rotation based on horizontal movement
    - Add slight scale reduction during drag
    - Use useNativeDriver for performance
    - _Requirements: 1.6, 4.3, 4.4, 7.2, 7.3_



  - [x] 5.4 Implement return-to-center animation
    - Use spring animation for natural feel
    - Animate all transforms back to 0
    - Set appropriate damping and stiffness values
    - _Requirements: 1.4, 4.5_

  - [x] 5.5 Create exit animations for each direction

    - Right swipe: slide right off-screen with fade
    - Left swipe: slide left off-screen with fade
    - Up swipe: slide up off-screen with fade
    - Add scale-down effect during exit
    - _Requirements: 1.7, 4.6_


  - [x] 5.6 Add tap gesture for navigation

    - Detect tap vs swipe gestures
    - Navigate to detail page on tap
    - Prevent navigation during active swipe
    - _Requirements: 1.9, 4.9_

- [x] 6. Create SwipeOverlay component





  - [x] 6.1 Implement overlay rendering logic

    - Show appropriate overlay based on swipe direction
    - Calculate opacity based on swipe distance
    - Display icon, text, and gradient for each direction
    - _Requirements: 1.5, 4.1, 4.2, 4.3_


  - [x] 6.2 Style overlays for each action

    - Right (watched): green gradient with checkmark
    - Left (later): orange gradient with clock icon
    - Up (remove): red gradient with trash icon
    - Ensure text and icons are clearly visible
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Create StartWatchingWidget main component





  - [x] 7.1 Set up component state and initialization


    - Initialize state for cards, phase, dismissedIds, loading, error
    - Load user preferences and subscriptions on mount
    - Fetch initial 3 recommendations
    - Set up refresh trigger listener
    - _Requirements: 2.1, 6.1, 7.1_


  - [x] 7.2 Implement card replacement logic

    - Handle swipe action completion
    - Fetch next recommendation from queue service
    - Replace card at specific index with fade animation
    - Update dismissed IDs set
    - _Requirements: 2.2, 2.4, 2.5, 2.7_

  - [x] 7.3 Create phase transition handling

    - Detect when watchlist phase is exhausted
    - Show TransitionMessage component
    - Wait 2 seconds before switching to taste phase
    - Initialize taste recommendations
    - _Requirements: 3.2, 3.3, 3.8_



  - [x] 7.4 Implement horizontal card layout

    - Display 3 cards in a row with equal spacing
    - Ensure no scrolling (fixed 3 cards)
    - Add proper margins and sizing
    - Stack cards with slight depth effect
    - _Requirements: 2.1, 2.3, 2.9, 4.8_


  - [x] 7.5 Add loading and error states

    - Show loading spinner during initial fetch
    - Display error message on fetch failure
    - Implement retry mechanism
    - _Requirements: 6.5, 8.2, 8.3_

  - [x] 7.6 Create widget header

    - Display "Start Watching" title with TV icon
    - Show "Pick your next show" subtitle
    - Add "View All" link to recommendations page
    - Display relative timestamp for last update
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Create TransitionMessage component




  - [x] 8.1 Implement transition message display


    - Show "More Recommendations Based on Your Taste Profile" message
    - Add fade-in animation
    - Auto-dismiss after 2 seconds
    - Trigger callback on dismiss
    - _Requirements: 3.2, 3.3_

- [x] 9. Create EmptyState component




  - [x] 9.1 Implement empty state variations


    - No subscriptions: "Set Up Subscriptions" with button
    - No matching content: "No unwatched items available"
    - All caught up: "All caught up! Check back later"
    - _Requirements: 6.6, 6.7, 3.11, 8.5_

- [x] 10. Implement performance optimizations







  - [x] 10.1 Add prefetching for next recommendations
    - Fetch next recommendation in background
    - Cache result for instant replacement
    - Limit prefetch to 2 items ahead
    - _Requirements: 7.4, 7.8_



  - [x] 10.2 Implement image caching
    - Use cached poster images when available
    - Preload images for queued cards
    - Handle image load failures gracefully
    - _Requirements: 7.5, 8.8_

  - [x] 10.3 Add debouncing for rapid swipes


    - Queue rapid swipe actions
    - Process sequentially to prevent race conditions
    - Disable gestures during action processing
    - _Requirements: 7.6, 4.10_

  - [x] 10.4 Optimize animation performance


    - Use useNativeDriver for all animations
    - Memoize expensive calculations
    - Clean up animations on unmount
    - _Requirements: 7.2, 7.3, 7.7_

- [x] 11. Add error handling and edge cases




  - [x] 11.1 Implement network error handling


    - Add retry logic with exponential backoff
    - Show offline indicator when network unavailable
    - Disable swipe actions when offline
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 Handle edge cases


    - Last card swiped: show "All caught up!" message
    - Only 1-2 items available: display without fetching more
    - Duplicate items: filter out before displaying
    - Provider logo fails: show provider name as fallback
    - _Requirements: 8.5, 8.6, 8.7, 8.8_

  - [x] 11.3 Add animation interruption handling


    - Complete animations gracefully if interrupted
    - Prevent new gestures during exit animations
    - Clean up animation state on unmount
    - _Requirements: 8.9, 4.10_

  - [x] 11.4 Implement state persistence


    - Preserve widget state on tab switch
    - Restore dismissed IDs on remount
    - Clear old dismissed IDs (keep last 50)
    - _Requirements: 8.10, 5.10_

- [ ]* 12. Add accessibility features
  - [ ]* 12.1 Create button alternatives for swipe gestures
    - Add "Remove", "Later", "Watched" buttons below each card
    - Style buttons clearly with icons and labels
    - Trigger same actions as swipe gestures
    - _Requirements: 9.1, 9.2_

  - [ ]* 12.2 Add screen reader support
    - Add descriptive accessibility labels to cards
    - Announce swipe actions to screen readers
    - Ensure buttons are keyboard navigable
    - _Requirements: 9.3, 9.4_

  - [ ]* 12.3 Support reduced motion preferences
    - Detect system reduced motion setting
    - Use simpler transitions when enabled
    - Maintain functionality without animations
    - _Requirements: 9.5_

- [ ] 13. Integration and testing





  - [x] 13.1 Integrate widget into home screen


    - Replace existing RealTimeRecommendationWidget
    - Pass appropriate props and callbacks
    - Test with real user data
    - _Requirements: All_


  - [x] 13.2 Test swipe gestures on device

    - Test all three swipe directions
    - Verify threshold detection
    - Check animation smoothness
    - Test rapid swipes
    - _Requirements: 1.1-1.9, 4.1-4.10_



  - [x] 13.3 Test phase transition
    - Exhaust watchlist items
    - Verify transition message appears
    - Confirm taste recommendations load
    - Test with various watchlist sizes
    - _Requirements: 3.1-3.11_



  - [x] 13.4 Test error scenarios

    - Simulate network failures
    - Test with no subscriptions
    - Test with empty watchlist
    - Verify error recovery
    - _Requirements: 8.1-8.10_




  - [x] 13.5 Performance testing

    - Measure initial load time (target: <500ms)
    - Verify 60fps during animations
    - Test with slow network
    - Check memory usage
    - _Requirements: 7.1-7.8_
