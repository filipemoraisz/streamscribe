# Requirements Document

## Introduction

The Start Watching Widget is an interactive, swipe-based discovery feature that helps users decide what to watch next from their unwatched watchlist. Using intuitive swipe gestures (similar to Tinder), users can quickly take action on recommendations: mark content as started, dismiss for later, or remove from their watchlist entirely. The widget maintains a constant queue of 4 items and automatically refills as users interact, creating a seamless discovery experience.

## Requirements

### Requirement 1: Swipe Gesture System

**User Story:** As a user, I want to swipe on recommendation cards to quickly take action, so that I can efficiently manage my watchlist and decide what to watch next.

#### Acceptance Criteria

1. WHEN user swipes right on a card THEN the system SHALL mark the first episode as watched (for TV shows) or mark the movie as watched
2. WHEN user swipes left on a card THEN the system SHALL dismiss the recommendation (hide from this widget but keep in watchlist)
3. WHEN user swipes up on a card THEN the system SHALL remove the item from the watchlist entirely
4. WHEN user swipes with insufficient velocity or distance THEN the card SHALL animate back to its original position
5. WHEN user is mid-swipe THEN the card SHALL display visual feedback indicating the action that will be triggered (color overlay, icon, text)
6. WHEN swipe gesture is detected THEN the card SHALL rotate slightly based on horizontal swipe direction for natural feel
7. WHEN swipe threshold is reached THEN the card SHALL animate off-screen in the swipe direction
8. WHEN card animates off-screen THEN the next card SHALL animate into view from behind

### Requirement 2: Queue Management

**User Story:** As a user, I want the widget to show me 3 fixed recommendations in a horizontal row, starting with my watchlist and then showing personalized suggestions, so that I always have fresh content to discover.

#### Acceptance Criteria

1. WHEN widget loads THEN it SHALL display exactly 3 recommendation cards in a horizontal row
2. WHEN user takes action on any card THEN the system SHALL immediately fetch a new recommendation to replace it
3. WHEN widget displays cards THEN there SHALL be NO scrolling - only 3 fixed cards visible
4. WHEN card is swiped away THEN it SHALL fade out and new card SHALL fade in at the same position
5. WHEN new card is added THEN it SHALL appear with scale-up and fade-in animation
6. WHEN recommendations are filtered THEN they SHALL only include items from user's subscribed streaming services
7. WHEN an item is dismissed THEN it SHALL be tracked to prevent showing again in the same session
8. WHEN user marks item as watched THEN it SHALL be removed from the widget queue immediately
9. WHEN cards are displayed horizontally THEN they SHALL have equal spacing and sizing
10. WHEN user swipes on any of the 3 cards THEN only that card SHALL respond to the gesture

### Requirement 3: Two-Phase Recommendation System

**User Story:** As a user, I want to see my unwatched watchlist items first, and then get personalized recommendations based on my taste profile when I've gone through my watchlist, so that I always have something new to discover.

#### Acceptance Criteria

1. WHEN widget loads THEN it SHALL first show recommendations from user's unwatched watchlist
2. WHEN all watchlist items are exhausted (watched, dismissed, or removed) THEN the widget SHALL display transition message "More Recommendations Based on Your Taste Profile"
3. WHEN transition message is shown THEN it SHALL display for 2 seconds before showing taste-based recommendations
4. WHEN taste-based recommendations begin THEN the widget SHALL analyze user's viewing history from database
5. WHEN analyzing taste profile THEN the system SHALL consider: watched content genres, average ratings of watched content, preferred content types (movie vs TV), watch frequency patterns, and streaming service preferences
6. WHEN generating taste recommendations THEN the system SHALL query TMDB for content matching user's taste profile
7. WHEN taste recommendations are shown THEN they SHALL be filtered to only include content available on user's subscribed services
8. WHEN user dismisses taste recommendation THEN it SHALL not be shown again in current session
9. WHEN user marks taste recommendation as watched THEN it SHALL be added to their watch history
10. WHEN user adds taste recommendation to watchlist THEN it SHALL appear in their watchlist immediately
11. WHEN no taste recommendations can be generated THEN the widget SHALL show "All caught up! Check back later" message

### Requirement 4: Visual Feedback and Animations

**User Story:** As a user, I want smooth animations and clear visual feedback during swipes, so that I understand what action will be taken and the interface feels responsive.

#### Acceptance Criteria

1. WHEN user begins swiping right THEN the card SHALL show a green overlay with checkmark icon and "WATCHED" text
2. WHEN user begins swiping left THEN the card SHALL show an orange overlay with dismiss icon and "LATER" text
3. WHEN user begins swiping up THEN the card SHALL show a red overlay with trash icon and "REMOVE" text
4. WHEN overlay appears THEN its opacity SHALL increase proportionally to swipe distance
5. WHEN card is released below threshold THEN it SHALL spring back to center with bounce animation
6. WHEN card is released above threshold THEN it SHALL accelerate off-screen with ease-out animation
7. WHEN card exits THEN the next card SHALL scale up from 0.95 to 1.0 and fade from 0.8 to 1.0 opacity
8. WHEN multiple cards are stacked THEN each SHALL have slight offset and scale reduction for depth effect
9. WHEN user taps a card THEN it SHALL navigate to the detail page with no swipe action
10. WHEN animations are in progress THEN user interactions SHALL be disabled to prevent race conditions

### Requirement 5: Action Handling

**User Story:** As a user, I want my swipe actions to be processed reliably and reflected across the app, so that my watchlist and progress stay accurate.

#### Acceptance Criteria

1. WHEN user swipes right on a TV show THEN the system SHALL mark episode 1 season 1 as watched via progressService
2. WHEN user swipes right on a movie THEN the system SHALL mark the movie as watched via storageService
3. WHEN user swipes left on any item THEN the system SHALL add item ID to dismissed list in local state
4. WHEN user swipes up on any item THEN the system SHALL remove item from watchlist via storageService
5. WHEN action completes successfully THEN the system SHALL log the action for analytics
6. WHEN action fails THEN the system SHALL show error toast and revert the card to queue
7. WHEN action is in progress THEN the system SHALL show loading indicator on the card
8. WHEN user marks TV show as watched THEN the system SHALL update user's progress tracking
9. WHEN user removes item from watchlist THEN the system SHALL trigger watchlist update across app
10. WHEN dismissed items list grows beyond 50 THEN the system SHALL clear oldest entries

### Requirement 6: Widget Header and Metadata

**User Story:** As a user, I want clear information about what this widget does and when it was last updated, so that I understand its purpose and freshness.

#### Acceptance Criteria

1. WHEN widget renders THEN it SHALL display "Start Watching" as the title
2. WHEN widget renders THEN it SHALL display "Pick your next show" as the subtitle
3. WHEN widget has recommendations THEN it SHALL show "View All" link to full recommendations page
4. WHEN widget updates THEN it SHALL display relative timestamp (e.g., "Just updated", "Updated 5m ago")
5. WHEN widget is loading THEN it SHALL display loading spinner next to title
6. WHEN user has no subscribed services THEN it SHALL show "Set Up Subscriptions" empty state
7. WHEN user has subscriptions but no matching content THEN it SHALL show "No unwatched items" empty state

### Requirement 7: Performance and Optimization

**User Story:** As a user, I want the widget to load quickly and respond instantly to my swipes, so that the experience feels smooth and native.

#### Acceptance Criteria

1. WHEN widget mounts THEN initial 3 recommendations SHALL load within 500ms
2. WHEN user swipes THEN gesture response SHALL have less than 16ms latency (60fps)
3. WHEN card animates THEN animation SHALL maintain 60fps throughout
4. WHEN new card is fetched THEN it SHALL load in background without blocking UI
5. WHEN images load THEN they SHALL use cached versions when available
6. WHEN multiple rapid swipes occur THEN the system SHALL queue actions and process sequentially
7. WHEN widget unmounts THEN all animations and timers SHALL be cleaned up
8. WHEN recommendations are cached THEN they SHALL be reused for 5 minutes before refresh

### Requirement 8: Error Handling and Edge Cases

**User Story:** As a user, I want the widget to handle errors gracefully and work reliably even in edge cases, so that I never lose data or get stuck.

#### Acceptance Criteria

1. WHEN network request fails THEN the system SHALL retry up to 3 times with exponential backoff
2. WHEN all retries fail THEN the system SHALL show error message and keep current cards
3. WHEN user is offline THEN the system SHALL show offline indicator and disable swipe actions
4. WHEN user swipes during loading THEN the gesture SHALL be ignored with visual feedback
5. WHEN last card is swiped THEN the widget SHALL show "All caught up!" message
6. WHEN user has only 1-3 items THEN the widget SHALL display them without trying to fetch more
7. WHEN duplicate items are fetched THEN the system SHALL filter them out
8. WHEN provider logo fails to load THEN the system SHALL show provider name as text fallback
9. WHEN animation is interrupted THEN the system SHALL complete it gracefully before next action
10. WHEN user rapidly switches tabs THEN the widget SHALL preserve its state

### Requirement 9: Accessibility

**User Story:** As a user with accessibility needs, I want alternative ways to interact with the widget, so that I can use it regardless of my abilities.

#### Acceptance Criteria

1. WHEN user cannot swipe THEN the system SHALL provide button alternatives for each action
2. WHEN buttons are displayed THEN they SHALL be clearly labeled with action names
3. WHEN user uses screen reader THEN all cards SHALL have descriptive labels
4. WHEN user uses keyboard THEN they SHALL be able to navigate and trigger actions
5. WHEN animations are reduced in system settings THEN the widget SHALL use simpler transitions
