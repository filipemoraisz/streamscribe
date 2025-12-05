# Start Watching Widget - Testing Guide

This document provides comprehensive testing instructions for the Start Watching Widget feature. Follow these test cases to verify all functionality works as expected.

## Prerequisites

Before testing, ensure:
- The app is running on a physical device or emulator
- You have a valid user account with authentication
- You have at least one streaming service subscription configured
- You have items in your watchlist
- Network connectivity is available (for some tests)

## Test Suite 13.2: Swipe Gestures on Device

**Requirements Tested:** 1.1-1.9, 4.1-4.10

### Test Case 13.2.1: Right Swipe (Mark as Watched)

**Steps:**
1. Open the app and navigate to the home screen
2. Locate the "Start Watching" widget
3. Swipe the first card to the right (at least 120px)
4. Observe the visual feedback during swipe

**Expected Results:**
- ✅ Green overlay appears with checkmark icon and "WATCHED" text
- ✅ Overlay opacity increases as swipe distance increases
- ✅ Card rotates slightly in the direction of swipe
- ✅ Card animates off-screen to the right when released
- ✅ For TV shows: Episode 1 Season 1 is marked as watched
- ✅ For movies: Movie is marked as watched
- ✅ New card fades in to replace the swiped card
- ✅ Card is removed from the widget queue

### Test Case 13.2.2: Left Swipe (Dismiss/Later)

**Steps:**
1. Swipe a card to the left (at least 120px)
2. Observe the visual feedback during swipe

**Expected Results:**
- ✅ Orange overlay appears with clock icon and "LATER" text
- ✅ Overlay opacity increases as swipe distance increases
- ✅ Card rotates slightly in the direction of swipe
- ✅ Card animates off-screen to the left when released
- ✅ Item is dismissed (won't show again in this session)
- ✅ Item remains in watchlist
- ✅ New card fades in to replace the swiped card

### Test Case 13.2.3: Up Swipe (Remove from Watchlist)

**Steps:**
1. Swipe a card upward (at least 100px)
2. Observe the visual feedback during swipe

**Expected Results:**
- ✅ Red overlay appears with trash icon and "REMOVE" text
- ✅ Overlay opacity increases as swipe distance increases
- ✅ Card animates off-screen upward when released
- ✅ Item is removed from watchlist entirely
- ✅ New card fades in to replace the swiped card
- ✅ Item no longer appears in watchlist screen

### Test Case 13.2.4: Threshold Detection

**Steps:**
1. Swipe a card right but release before reaching 120px threshold
2. Swipe a card left but release before reaching 120px threshold
3. Swipe a card up but release before reaching 100px threshold

**Expected Results:**
- ✅ Card springs back to center position with bounce animation
- ✅ No action is triggered
- ✅ Card remains in the same position
- ✅ Overlay fades out as card returns

### Test Case 13.2.5: Velocity-Based Swipe

**Steps:**
1. Perform a quick swipe right (high velocity, short distance)
2. Perform a quick swipe left (high velocity, short distance)
3. Perform a quick swipe up (high velocity, short distance)

**Expected Results:**
- ✅ Swipe is recognized even with shorter distance if velocity > 0.3 px/ms
- ✅ Appropriate action is triggered
- ✅ Card animates off-screen smoothly

### Test Case 13.2.6: Animation Smoothness

**Steps:**
1. Swipe multiple cards in different directions
2. Observe frame rate and smoothness

**Expected Results:**
- ✅ All animations maintain 60fps
- ✅ No stuttering or lag during swipe
- ✅ Smooth transitions between states
- ✅ Native driver is used for all animations

### Test Case 13.2.7: Rapid Swipes

**Steps:**
1. Quickly swipe the first card right
2. Immediately swipe the second card left
3. Immediately swipe the third card up

**Expected Results:**
- ✅ Actions are queued and processed sequentially
- ✅ No race conditions occur
- ✅ All actions complete successfully
- ✅ Cards are replaced in correct order
- ✅ No duplicate cards appear

### Test Case 13.2.8: Tap Gesture (Navigation)

**Steps:**
1. Tap on a card (without swiping)
2. Observe navigation behavior

**Expected Results:**
- ✅ Navigation to detail page occurs
- ✅ No swipe action is triggered
- ✅ Card remains in widget after returning

### Test Case 13.2.9: Gesture Interruption

**Steps:**
1. Start swiping a card
2. Release finger mid-swipe
3. Try to interact with another card immediately

**Expected Results:**
- ✅ First card returns to center or completes exit animation
- ✅ Gestures are disabled during exit animations
- ✅ No conflicts between simultaneous gestures
- ✅ Animation state is cleaned up properly

---

## Test Suite 13.3: Phase Transition

**Requirements Tested:** 3.1-3.11

### Test Case 13.3.1: Watchlist Phase Initialization

**Steps:**
1. Ensure you have at least 5 items in your watchlist
2. Open the app and navigate to home screen
3. Observe the Start Watching widget

**Expected Results:**
- ✅ Widget displays 3 cards from watchlist
- ✅ Cards show items from user's subscribed services only
- ✅ Widget header shows "Start Watching" title
- ✅ Subtitle shows "Pick your next show"
- ✅ Timestamp shows "Just updated"

### Test Case 13.3.2: Exhaust Watchlist Items

**Steps:**
1. Swipe through all watchlist items (right, left, or up)
2. Continue until no watchlist items remain

**Expected Results:**
- ✅ Each swipe replaces card with next watchlist item
- ✅ Cards are fetched from watchlist queue
- ✅ No duplicate items appear

### Test Case 13.3.3: Transition Message Display

**Steps:**
1. Continue from Test Case 13.3.2
2. Swipe the last watchlist item
3. Observe the transition

**Expected Results:**
- ✅ Transition message appears: "More Recommendations Based on Your Taste Profile"
- ✅ Message displays for exactly 2 seconds
- ✅ Message has fade-in animation
- ✅ Widget header remains visible during transition

### Test Case 13.3.4: Taste Phase Initialization

**Steps:**
1. Wait for transition message to dismiss
2. Observe the new recommendations

**Expected Results:**
- ✅ Widget displays 3 new cards from taste recommendations
- ✅ Recommendations are based on user's viewing history
- ✅ Recommendations match user's favorite genres
- ✅ Recommendations are filtered by subscribed services
- ✅ Previously dismissed items don't reappear

### Test Case 13.3.5: Taste Recommendations Quality

**Steps:**
1. Review the taste-based recommendations
2. Check if they match your viewing preferences

**Expected Results:**
- ✅ Recommendations align with watched content genres
- ✅ Content type preference is respected (movie vs TV)
- ✅ Rating similarity is considered
- ✅ Recommendations are relevant and personalized

### Test Case 13.3.6: Small Watchlist (1-2 Items)

**Steps:**
1. Remove items from watchlist until only 1-2 remain
2. Refresh the widget
3. Swipe through remaining items

**Expected Results:**
- ✅ Widget displays available items (1-2 cards)
- ✅ Doesn't try to fetch more watchlist items
- ✅ Transitions to taste phase after exhausting available items
- ✅ No errors or crashes occur

### Test Case 13.3.7: Empty Watchlist

**Steps:**
1. Remove all items from watchlist
2. Refresh the widget

**Expected Results:**
- ✅ Widget immediately shows taste-based recommendations
- ✅ No transition message is shown
- ✅ 3 taste recommendations are displayed

### Test Case 13.3.8: Taste Phase Continuation

**Steps:**
1. In taste phase, swipe through multiple recommendations
2. Continue swiping to test queue refill

**Expected Results:**
- ✅ Taste queue refills automatically when low
- ✅ New recommendations continue to appear
- ✅ No duplicate recommendations
- ✅ Recommendations remain relevant

---

## Test Suite 13.4: Error Scenarios

**Requirements Tested:** 8.1-8.10

### Test Case 13.4.1: Network Failure During Load

**Steps:**
1. Disable network connectivity (airplane mode)
2. Open the app and navigate to home screen
3. Observe the widget behavior

**Expected Results:**
- ✅ Widget shows offline indicator
- ✅ Error message: "No network connection. Please check your internet."
- ✅ Retry button is displayed
- ✅ Swipe actions are disabled
- ✅ No crash occurs

### Test Case 13.4.2: Network Failure During Swipe

**Steps:**
1. Load widget with network enabled
2. Disable network connectivity
3. Try to swipe a card

**Expected Results:**
- ✅ Offline indicator appears in header
- ✅ Swipe gesture is disabled
- ✅ Error message: "Cannot perform action while offline"
- ✅ Card remains in place
- ✅ No data loss occurs

### Test Case 13.4.3: Network Recovery

**Steps:**
1. Continue from Test Case 13.4.2
2. Re-enable network connectivity
3. Observe widget behavior

**Expected Results:**
- ✅ Offline indicator disappears
- ✅ Widget automatically retries loading
- ✅ Swipe actions are re-enabled
- ✅ Error message clears
- ✅ Widget resumes normal operation

### Test Case 13.4.4: Retry with Exponential Backoff

**Steps:**
1. Simulate intermittent network failures
2. Observe retry behavior in console logs

**Expected Results:**
- ✅ First retry after 1 second
- ✅ Second retry after 2 seconds
- ✅ Third retry after 4 seconds
- ✅ Maximum 3 retry attempts
- ✅ Error shown after all retries fail

### Test Case 13.4.5: No Subscriptions

**Steps:**
1. Remove all streaming service subscriptions
2. Refresh the widget

**Expected Results:**
- ✅ Empty state appears: "Set Up Subscriptions"
- ✅ Button to navigate to subscription settings
- ✅ No cards are displayed
- ✅ No errors occur

### Test Case 13.4.6: Empty Watchlist and No Taste Recommendations

**Steps:**
1. Remove all watchlist items
2. Clear viewing history (if possible)
3. Refresh the widget

**Expected Results:**
- ✅ Empty state appears: "All caught up! Check back later"
- ✅ No cards are displayed
- ✅ Widget header remains visible
- ✅ No errors occur

### Test Case 13.4.7: Last Card Swiped

**Steps:**
1. Swipe through all available recommendations
2. Swipe the last card

**Expected Results:**
- ✅ "All caught up!" message appears
- ✅ No more cards are displayed
- ✅ Widget remains functional
- ✅ Can refresh to get new recommendations

### Test Case 13.4.8: Image Load Failure

**Steps:**
1. Observe cards with missing or broken poster images
2. Check provider logo display

**Expected Results:**
- ✅ Placeholder image or fallback is shown
- ✅ Provider name appears as text if logo fails
- ✅ Card remains functional
- ✅ No crash occurs

### Test Case 13.4.9: Duplicate Items Filtered

**Steps:**
1. Observe recommendations over multiple sessions
2. Check for duplicate items

**Expected Results:**
- ✅ No duplicate items appear in same session
- ✅ Dismissed items don't reappear
- ✅ Watched items don't reappear

### Test Case 13.4.10: State Persistence

**Steps:**
1. Dismiss several items
2. Switch to another tab
3. Return to home screen
4. Close and reopen the app

**Expected Results:**
- ✅ Widget state is preserved on tab switch
- ✅ Dismissed IDs are restored on app reopen
- ✅ Last 50 dismissed IDs are kept
- ✅ Old dismissed IDs are cleared

---

## Test Suite 13.5: Performance Testing

**Requirements Tested:** 7.1-7.8

### Test Case 13.5.1: Initial Load Time

**Steps:**
1. Clear app cache
2. Open the app and navigate to home screen
3. Measure time until widget displays cards

**Expected Results:**
- ✅ Initial load completes in < 500ms
- ✅ Loading spinner is shown during load
- ✅ User data loads before TMDB content
- ✅ No blocking operations

**Measurement:**
- Use React DevTools Profiler
- Check console timestamps
- Monitor network requests

### Test Case 13.5.2: Animation Frame Rate

**Steps:**
1. Enable FPS monitor in developer settings
2. Perform various swipe gestures
3. Observe frame rate during animations

**Expected Results:**
- ✅ Maintains 60fps during swipe
- ✅ Maintains 60fps during card exit
- ✅ Maintains 60fps during card entrance
- ✅ No dropped frames
- ✅ Native driver is used

**Measurement:**
- Use React Native Performance Monitor
- Enable "Show Perf Monitor" in dev menu
- Check JS frame rate and UI frame rate

### Test Case 13.5.3: Slow Network Performance

**Steps:**
1. Enable network throttling (Slow 3G)
2. Refresh the widget
3. Perform swipe actions

**Expected Results:**
- ✅ Widget remains responsive during slow network
- ✅ Loading states are shown appropriately
- ✅ Cached images load instantly
- ✅ Background fetching doesn't block UI
- ✅ Timeout handling works correctly

### Test Case 13.5.4: Memory Usage

**Steps:**
1. Open the app and navigate to home screen
2. Swipe through 20+ recommendations
3. Monitor memory usage

**Expected Results:**
- ✅ Memory usage remains stable
- ✅ No memory leaks detected
- ✅ Images are properly cached and released
- ✅ Animation cleanup occurs on unmount
- ✅ Event listeners are removed

**Measurement:**
- Use Xcode Instruments (iOS) or Android Profiler
- Monitor heap allocations
- Check for memory leaks

### Test Case 13.5.5: Prefetching Effectiveness

**Steps:**
1. Observe network requests during swipes
2. Check image loading behavior

**Expected Results:**
- ✅ Next recommendation is prefetched in background
- ✅ Images are preloaded for queued cards
- ✅ Prefetch limit is 2 items ahead
- ✅ Instant card replacement on swipe

### Test Case 13.5.6: Debouncing Rapid Swipes

**Steps:**
1. Perform 5 rapid swipes in quick succession
2. Observe action processing

**Expected Results:**
- ✅ Actions are queued properly
- ✅ Actions process sequentially
- ✅ No race conditions occur
- ✅ All actions complete successfully
- ✅ UI remains responsive

### Test Case 13.5.7: Memoization and Optimization

**Steps:**
1. Use React DevTools Profiler
2. Observe component re-renders during interactions

**Expected Results:**
- ✅ Expensive calculations are memoized
- ✅ Unnecessary re-renders are prevented
- ✅ Callbacks are properly memoized
- ✅ Relative time calculation is optimized

### Test Case 13.5.8: Cleanup on Unmount

**Steps:**
1. Navigate to home screen
2. Navigate away from home screen
3. Check for cleanup in console

**Expected Results:**
- ✅ Action queue is cleared
- ✅ Network listeners are removed
- ✅ Timers are cancelled
- ✅ Animations are stopped
- ✅ No memory leaks

---

## Testing Checklist

Use this checklist to track your testing progress:

### Swipe Gestures (13.2)
- [ ] Right swipe (mark as watched)
- [ ] Left swipe (dismiss)
- [ ] Up swipe (remove)
- [ ] Threshold detection
- [ ] Velocity-based swipe
- [ ] Animation smoothness
- [ ] Rapid swipes
- [ ] Tap gesture
- [ ] Gesture interruption

### Phase Transition (13.3)
- [ ] Watchlist phase initialization
- [ ] Exhaust watchlist items
- [ ] Transition message display
- [ ] Taste phase initialization
- [ ] Taste recommendations quality
- [ ] Small watchlist (1-2 items)
- [ ] Empty watchlist
- [ ] Taste phase continuation

### Error Scenarios (13.4)
- [ ] Network failure during load
- [ ] Network failure during swipe
- [ ] Network recovery
- [ ] Retry with exponential backoff
- [ ] No subscriptions
- [ ] Empty watchlist and no taste recommendations
- [ ] Last card swiped
- [ ] Image load failure
- [ ] Duplicate items filtered
- [ ] State persistence

### Performance (13.5)
- [ ] Initial load time < 500ms
- [ ] Animation frame rate 60fps
- [ ] Slow network performance
- [ ] Memory usage stable
- [ ] Prefetching effectiveness
- [ ] Debouncing rapid swipes
- [ ] Memoization and optimization
- [ ] Cleanup on unmount

---

## Known Issues and Limitations

Document any issues found during testing:

1. **Issue:** [Description]
   - **Severity:** [Critical/High/Medium/Low]
   - **Steps to Reproduce:** [Steps]
   - **Expected:** [Expected behavior]
   - **Actual:** [Actual behavior]

---

## Testing Environment

Document your testing environment:

- **Device:** [e.g., iPhone 14 Pro, Pixel 7]
- **OS Version:** [e.g., iOS 17.0, Android 13]
- **App Version:** [Version number]
- **Network:** [WiFi/4G/5G]
- **Date Tested:** [Date]
- **Tester:** [Name]

---

## Conclusion

After completing all test cases, summarize:

- **Total Tests:** [Number]
- **Passed:** [Number]
- **Failed:** [Number]
- **Blocked:** [Number]
- **Overall Status:** [Pass/Fail]

**Notes:**
[Any additional observations or recommendations]
