# Task: Implement Spoiler Prevention (Block Marking Unaired Content)

## Objective
Prevent users from marking TV show episodes or movies as "watched" if they have not yet aired. This is to avoid accidental spoilers and maintain data integrity.

## Requirements

1.  **Service Logic**:
    *   Ensure `progressService` (or a relevant service) has a robust method `isEpisodeAired(airDate: string): boolean`.
    *   Logic: Parse `airDate`. If invalid/null, default to `true` (allow watching) or handle gracefully. If valid, compare with `new Date()`. Return `false` if `airDate > now`.

2.  **UI Integration**:
    *   **Home Screen (`app/(tabs)/index.tsx`)**: Update `handleNextEpisodePress` (and `handleMovieActionPress`) to check `isEpisodeAired` before calling `markEpisodeWatched` / `markAsWatched`. Show an alert if not aired.
    *   **Watchlist Screen (`app/(tabs)/watchlist.tsx`)**: Apply the same check in `handleQuickMarkEpisode` and `handleQuickMarkMovie`.
    *   **Episode Details**: Prevent marking as watched in the episode details screen if not aired.
    *   **Movie Details**: Prevent marking as watched in the movie details screen if not aired.

3.  **User Feedback**:
    *   Display a clear Alert or Toast message when the user tries to mark an unaired item (e.g., "This episode hasn't aired yet!").

4.  **Verification**:
    *   Test with released content (should work).
    *   Test with unreleased content (should block and alert).
