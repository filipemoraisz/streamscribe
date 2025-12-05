# Implementation Plan

- [x] 1. Create foundational UI components





  - Create EmptyState component with illustration, message, and optional CTA button
  - Create SkeletonLoader component with card, header, and section variants
  - Create ErrorState component with message and retry button
  - Set up component styling to match existing design system
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2_

- [ ]* 1.1 Write property test for EmptyState component
  - **Property 1: Empty state displays correctly**
  - **Validates: Requirements 1.1, 1.2**

- [ ]* 1.2 Write property test for ErrorState component
  - **Property 1: Error state displays correctly**
  - **Validates: Requirements 3.1, 3.2**

- [x] 2. Implement section-level state management





  - Add sectionLoadingStates and sectionErrors to home screen state
  - Create helper functions for managing section-specific loading/error states
  - Implement section-level retry logic
  - _Requirements: 2.2, 2.3, 3.3_

- [x] 3. Enhance existing MediaSection component




  - Add loading prop to display skeleton screens
  - Add error prop to display error state with retry
  - Add emptyMessage prop to display empty state
  - Add filterType and activeFilter props for filtering support
  - Update component to conditionally render loading/error/empty/content states
  - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 7.2_

- [ ]* 3.1 Write property test for MediaSection filtering
  - **Property 4: Content filtering applies consistently**
  - **Validates: Requirements 7.2**

- [x] 4. Create OnboardingService





  - Implement hasSeenWelcome() method to check onboarding state
  - Implement markWelcomeSeen() method to persist dismissal
  - Use AsyncStorage for persistent storage
  - Add onboarding version tracking for future updates
  - _Requirements: 11.4, 11.5_

- [x] 5. Implement WelcomeModal component





  - Create modal with feature highlights and descriptions
  - Add "Get Started" button that dismisses modal
  - Integrate with OnboardingService for state management
  - Add animations for smooth appearance/dismissal
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 5.1 Write property test for welcome modal persistence
  - **Property 9: Welcome modal dismissal persists**
  - **Validates: Requirements 11.4**

- [x] 6. Create ContinueWatchingService







  - Implement getContinueWatching() method to fetch in-progress content
  - Query episode_progress table for TV shows with partial progress
  - Query watchlists for movies with partial watch status
  - Calculate progress percentages and next episode information
  - Sort results by most recently watched
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Implement ContinueWatchingSection component







  - Create horizontal scrollable section for in-progress content
  - Display progress bars for movies and TV shows
  - Show next episode information for TV shows
  - Add remove/dismiss functionality
  - Support loading, error, and empty states
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 7.1 Write property test for continue watching ordering
  - **Property 1: Continue watching items are properly structured and ordered**
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 8. Create PersonalizationService



  - Implement generateBecauseYouWatched() method
  - Analyze watch history to select source items (recently watched, highly rated)
  - Use TMDB API to find similar content based on genre, cast, rating
  - Limit to maximum of 3 sections
  - Calculate similarity scores for recommendations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Implement BecauseYouWatchedSection component





  - Create section with source title in header
  - Display horizontal scrollable list of recommendations
  - Show similarity indicators or scores
  - Support loading, error, and empty states
  - Integrate with watchlist actions
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 9.1 Write property test for recommendation generation
  - **Property 2: Recommendation sections are generated with proper limits and similarity**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 10. Extend TasteProfileService for genre sections





  - Implement generateGenreSections() method
  - Analyze watch history to identify top 3 preferred genres
  - Fetch content for each preferred genre from TMDB
  - Fall back to popular genres if no watch history
  - Return sections with genre names and content
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Implement GenreSection component




  - Create section with genre name in header
  - Display horizontal scrollable list of genre-specific content
  - Support loading, error, and empty states
  - Integrate with watchlist actions
  - _Requirements: 6.1, 6.3, 6.5_

- [ ]* 11.1 Write property test for genre section generation
  - **Property 3: Genre sections are generated from watch history analysis**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

- [x] 12. Implement QuickFilters component





  - Create horizontal chip buttons for "All", "Movies", "TV Shows"
  - Highlight active filter with visual styling
  - Handle filter selection and state updates
  - Add smooth transition animations
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 13. Add filter state management to home screen








  - Add activeFilter state ('all' | 'movie' | 'tv')
  - Implement filter change handler
  - Persist filter selection in session state
  - Apply filter to all content sections
  - _Requirements: 7.2, 7.5_

- [ ]* 13.1 Write property test for filter persistence
  - **Property 5: Filter selection persists during session**
  - **Validates: Requirements 7.5**

- [x] 14. Implement SurpriseButton component





  - Create prominent button with engaging design
  - Add loading state during random selection
  - Implement haptic feedback on press
  - Handle navigation to selected item
  - _Requirements: 8.1, 8.5_

- [x] 15. Add "Surprise Me" functionality to home screen





  - Implement random selection from taste profile recommendations
  - Fall back to trending content if no recommendations
  - Navigate to detail screen with selected item
  - Handle loading and error states
  - _Requirements: 8.2, 8.3, 8.4_

- [ ]* 15.1 Write property test for Surprise Me selection
  - **Property 6: Surprise Me selects from available recommendations**
  - **Validates: Requirements 8.2, 8.4**

- [x] 16. Create ContentDiscoveryService





  - Implement getNewThisWeek() method to fetch recently released content
  - Filter content by release date (last 7 days)
  - Include both movies and TV shows
  - Sort by release date descending
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 17. Implement NewThisWeekSection component




  - Create section for recently released content
  - Display release dates prominently
  - Support loading, error, and empty states
  - Integrate with watchlist actions
  - Hide section when no new content available
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 17.1 Write property test for New This Week filtering
  - **Property 7: New This Week content is properly filtered and ordered**
  - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 18. Extend ContentDiscoveryService for leaving soon





  - Implement getLeavingSoon() method
  - Query streaming availability changes table
  - Filter content leaving within 30 days on subscribed services
  - Calculate days remaining for each item
  - Sort by earliest departure date
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 19. Implement LeavingSoonSection component





  - Create section for content leaving streaming services
  - Display departure dates and days remaining
  - Show warning badges for watchlist items
  - Support loading, error, and empty states
  - Hide section when no content leaving soon
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 19.1 Write property test for Leaving Soon ordering
  - **Property 8: Leaving Soon items are properly structured and ordered**
  - **Validates: Requirements 10.2, 10.3, 10.4**

- [x] 20. Integrate all new sections into home screen





  - Add WelcomeModal at the top level
  - Add QuickFilters below ImpactHeader
  - Add SurpriseButton in prominent location
  - Add ContinueWatchingSection before watchlist
  - Add BecauseYouWatchedSections after StartWatchingWidget
  - Add GenreSections after personalized recommendations
  - Add NewThisWeekSection after genre sections
  - Add LeavingSoonSection after new content
  - Update existing MediaSections with new props
  - _Requirements: All_

- [x] 21. Implement progressive loading strategy





  - Load user data first (watchlist, stats, continue watching)
  - Load personalized sections second (recommendations, genres)
  - Load TMDB content last (trending, new releases)
  - Show skeleton screens for each section during loading
  - Replace skeletons with content as each section loads
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 22. Add error handling to all data fetching





  - Wrap all API calls in try-catch blocks
  - Set section-specific error states on failures
  - Display ErrorState components with retry buttons
  - Implement section-specific retry handlers
  - Log errors for debugging
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 23. Add empty states to all sections





  - Update watchlist section to show empty state when empty
  - Add empty states to all new sections
  - Ensure empty states have helpful messages and CTAs
  - Hide sections that should not appear when empty
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 24. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Optimize performance
  - Implement caching for TMDB responses (24 hours)
  - Implement caching for taste profile (5 minutes)
  - Implement caching for genre analysis (1 hour)
  - Use React.memo for section components
  - Use useCallback for event handlers
  - Implement FlatList windowSize optimization
  - _Requirements: All (Performance)_

- [ ]* 25.1 Write unit tests for caching logic
  - Test cache hit/miss scenarios
  - Test cache expiration
  - Test cache invalidation

- [ ] 26. Add accessibility improvements
  - Add proper labels to all interactive elements
  - Implement screen reader announcements for loading/error states
  - Ensure keyboard navigation works for filters and buttons
  - Verify color contrast meets WCAG standards
  - Test with screen reader enabled
  - _Requirements: All (Accessibility)_

- [ ]* 26.1 Write unit tests for accessibility
  - Test screen reader labels
  - Test keyboard navigation
  - Test focus management

- [ ] 27. Final polish and testing







  - Test all user flows end-to-end
  - Verify smooth animations and transitions
  - Test error recovery scenarios
  - Test with various data states (empty, partial, full)
  - Test filter functionality across all sections
  - Verify welcome modal only shows once
  - Test "Surprise Me" with various recommendation states
  - _Requirements: All_

- [ ] 28. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
