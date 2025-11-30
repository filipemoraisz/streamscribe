import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { EpisodeProgress, ShowProgress } from '../types';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import { achievementChecker } from './achievementChecker';
import { userActivityService } from './userActivity';

type OfflineAction =
    | { type: 'MARK_WATCHED'; payload: { showId: number; seasonNumber: number; episodeNumber: number; rating?: number } }
    | { type: 'MARK_UNWATCHED'; payload: { showId: number; seasonNumber: number; episodeNumber: number } }
    | { type: 'MARK_BATCH_WATCHED'; payload: { showId: number; seasonNumber: number; episodeNumbers: number[] } };

class ProgressService {
    private readonly QUEUE_KEY = 'streamscribe_offline_queue';

    constructor() {
        // Attempt to sync on startup
        this.syncPendingActions();
    }

    private async getProgressKey(type: 'episodes' | 'shows'): Promise<string> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user ? `streamscribe_${type}_progress_${user.id}` : `streamscribe_${type}_progress_guest`;
        } catch (error) {
            console.error('Error getting progress key:', error);
            return `streamscribe_${type}_progress_guest`;
        }
    }

    // --- Helper Methods ---

    private async determineShowStatus(showId: number, watchedEpisodes: EpisodeProgress[]): Promise<ShowProgress['status']> {
        try {
            const showDetails = await tmdbService.getTVShowDetails(showId);
            if (!showDetails) return 'watching';

            const totalEpisodes = showDetails.number_of_episodes;
            const isEnded = showDetails.status === 'Ended' || showDetails.status === 'Canceled';
            const lastAired = showDetails.last_episode_to_air;

            // Fallback: Calculate last aired from seasons if API field is missing
            let calculatedLastAired = lastAired;
            if (!calculatedLastAired && showDetails.seasons) {
                const airedSeasons = showDetails.seasons
                    .filter(s => s.season_number > 0 && s.air_date && new Date(s.air_date) <= new Date())
                    .sort((a, b) => b.season_number - a.season_number);

                if (airedSeasons.length > 0) {
                    calculatedLastAired = {
                        season_number: airedSeasons[0].season_number,
                        episode_number: airedSeasons[0].episode_count,
                        id: 0, name: '', overview: '', air_date: '', runtime: 0, still_path: null, vote_average: 0, vote_count: 0
                    };
                }
            }

            if (calculatedLastAired) {
                const hasWatchedLastAired = watchedEpisodes.some(ep =>
                    ep.season_number === calculatedLastAired.season_number &&
                    ep.episode_number === calculatedLastAired.episode_number
                );

                if (hasWatchedLastAired) {
                    return isEnded ? 'completed' : 'up_to_date';
                }
            } else {
                // Fallback if no last aired info
                if (watchedEpisodes.length >= totalEpisodes && totalEpisodes > 0) {
                    return isEnded ? 'completed' : 'up_to_date';
                }
            }
            return 'watching';
        } catch (error) {
            console.warn(`Error determining status for show ${showId}:`, error);
            return 'watching';
        }
    }

    // --- Offline Queue Management ---

    private async addToQueue(action: OfflineAction): Promise<void> {
        try {
            const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
            const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
            queue.push(action);
            await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));

            // Try to sync immediately
            this.syncPendingActions();
        } catch (error) {
            console.error('Error adding to offline queue:', error);
        }
    }

    async syncPendingActions(): Promise<void> {
        const state = await NetInfo.fetch();
        if (!state.isConnected) return;

        try {
            const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
            if (!queueJson) return;

            const queue: OfflineAction[] = JSON.parse(queueJson);
            if (queue.length === 0) return;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const remainingQueue: OfflineAction[] = [];
            let episodesWatchedCount = 0; // Track how many episodes were synced

            for (const action of queue) {
                try {
                    if (action.type === 'MARK_WATCHED') {
                        const { showId, seasonNumber, episodeNumber, rating } = action.payload;

                        // Upsert to Supabase
                        const { error } = await supabase.from('episode_progress').upsert({
                            user_id: user.id,
                            show_id: showId,
                            season_number: seasonNumber,
                            episode_number: episodeNumber,
                            watched: true,
                            watched_date: new Date().toISOString(),
                            rating,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id, show_id, season_number, episode_number' });

                        if (error) throw error;
                        
                        episodesWatchedCount++;

                    } else if (action.type === 'MARK_UNWATCHED') {
                        const { showId, seasonNumber, episodeNumber } = action.payload;

                        // Delete from Supabase
                        const { error } = await supabase.from('episode_progress').delete()
                            .match({
                                user_id: user.id,
                                show_id: showId,
                                season_number: seasonNumber,
                                episode_number: episodeNumber
                            });

                        if (error) throw error;
                    } else if (action.type === 'MARK_BATCH_WATCHED') {
                        const { showId, seasonNumber, episodeNumbers } = action.payload;
                        const now = new Date().toISOString();

                        const updates = episodeNumbers.map(epNum => ({
                            user_id: user.id,
                            show_id: showId,
                            season_number: seasonNumber,
                            episode_number: epNum,
                            watched: true,
                            watched_date: now,
                            updated_at: now
                        }));

                        const { error } = await supabase.from('episode_progress').upsert(updates, {
                            onConflict: 'user_id, show_id, season_number, episode_number'
                        });

                        if (error) throw error;
                    }
                } catch (err) {
                    console.error('Failed to sync action:', action, err);
                    remainingQueue.push(action); // Keep failed actions
                }
            }

            // Update queue with remaining items
            await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remainingQueue));

            // Update streak if episodes were synced
            if (episodesWatchedCount > 0) {
                console.log(`[Progress] Synced ${episodesWatchedCount} episodes, updating streak`);
                try {
                    await userActivityService.updateStreak(user.id);
                    console.log('[Progress] ✅ Streak updated after offline sync');
                } catch (streakError) {
                    console.error('[Progress] Error updating streak after sync:', streakError);
                }
            }

            // Refresh local cache from server to ensure consistency
            if (remainingQueue.length === 0) {
                await this.refreshCacheFromServer();
            }

        } catch (error) {
            console.error('Error syncing pending actions:', error);
        }
    }

    private async refreshCacheFromServer(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Episodes
            const { data: episodes, error: epError } = await supabase
                .from('episode_progress')
                .select('*')
                .eq('user_id', user.id);

            if (!epError && episodes) {
                const key = await this.getProgressKey('episodes');
                await AsyncStorage.setItem(key, JSON.stringify(episodes));
            }

            // Fetch Shows Summary
            const showIds = new Set(episodes?.map(e => e.show_id));
            const showProgressList: ShowProgress[] = [];

            for (const showId of Array.from(showIds)) {
                const showEpisodes = episodes!.filter(e => e.show_id === showId && e.watched);
                if (showEpisodes.length === 0) continue;

                // Find latest
                const latest = showEpisodes.reduce((prev, current) => {
                    if (current.season_number > prev.season_number) return current;
                    if (current.season_number === prev.season_number && current.episode_number > prev.episode_number) return current;
                    return prev;
                });

                // Determine status using the shared logic
                const status = await this.determineShowStatus(showId, showEpisodes);

                showProgressList.push({
                    id: `${user.id}-${showId}`,
                    user_id: user.id,
                    show_id: showId,
                    current_season: latest.season_number,
                    current_episode: latest.episode_number,
                    total_watched_episodes: showEpisodes.length,
                    last_watched_date: latest.watched_date || new Date().toISOString(),
                    status: status
                });
            }

            const showKey = await this.getProgressKey('shows');
            await AsyncStorage.setItem(showKey, JSON.stringify(showProgressList));
            console.log('[Progress] Refreshed cache from server. Total shows:', showProgressList.length);

        } catch (error) {
            console.error('Error refreshing cache from server:', error);
        }
    }

    // --- Episode Progress Methods ---

    async getEpisodeProgress(showId: number): Promise<EpisodeProgress[]> {
        try {
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];
            return allProgress.filter(ep => ep.show_id === showId);
        } catch (error) {
            console.error('Error getting episode progress:', error);
            return [];
        }
    }

    async markEpisodeWatched(
        showId: number,
        seasonNumber: number,
        episodeNumber: number,
        rating?: number
    ): Promise<void> {
        console.log(`[Progress] markEpisodeWatched called for showId: ${showId}, S${seasonNumber}E${episodeNumber}`);
        try {
            // 1. Optimistic Update
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || 'guest';

            const newEntry: EpisodeProgress = {
                id: `${userId}-${showId}-${seasonNumber}-${episodeNumber}`,
                user_id: userId,
                show_id: showId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                watched: true,
                watched_date: new Date().toISOString(),
                rating
            };

            // Remove existing if any (to replace)
            const filtered = allProgress.filter(ep => !(ep.show_id === showId && ep.season_number === seasonNumber && ep.episode_number === episodeNumber));
            filtered.push(newEntry);

            await AsyncStorage.setItem(key, JSON.stringify(filtered));
            await this.updateShowProgressLocal(showId);

            // 2. Sync to Supabase immediately (for achievement checking and streak tracking)
            if (userId !== 'guest') {
                console.log('[Progress] Syncing episode to Supabase for achievement checking');
                
                // Check if online
                const netInfo = await import('@react-native-community/netinfo').then(m => m.default.fetch());
                
                if (netInfo.isConnected) {
                    // Directly insert to Supabase (don't queue)
                    try {
                        const { error } = await supabase.from('episode_progress').upsert({
                            user_id: userId,
                            show_id: showId,
                            season_number: seasonNumber,
                            episode_number: episodeNumber,
                            watched: true,
                            watched_date: new Date().toISOString(),
                            rating,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id, show_id, season_number, episode_number' });

                        if (error) {
                            console.error('[Progress] Error syncing to Supabase:', error);
                            // Fallback: queue for later
                            await this.addToQueue({
                                type: 'MARK_WATCHED',
                                payload: { showId, seasonNumber, episodeNumber, rating }
                            });
                        } else {
                            console.log('[Progress] ✅ Episode synced to Supabase successfully');
                            
                            // 3. Update streak tracking and activity metrics (only when online and after successful sync)
                            console.log(`[Progress] Updating streak and activity tracking for user: ${userId}`);
                            try {
                                // Get episode runtime if available
                                let runtime = 45; // Default to 45 minutes
                                try {
                                    const episodeDetails = await tmdbService.getEpisodeDetails(showId, seasonNumber, episodeNumber);
                                    runtime = episodeDetails?.runtime || 45;
                                } catch (runtimeError) {
                                    console.warn('[Progress] Could not get episode runtime, using default');
                                }
                                
                                // Track episode watched event (updates streak, episode count, and hours)
                                await userActivityService.trackEpisodeWatched(userId, runtime);
                                console.log(`[Progress] ✅ Streak and activity tracking updated`);
                            } catch (streakError) {
                                console.error('[Progress] Error updating streak:', streakError);
                                // Don't fail the main operation if streak update fails
                            }
                        }
                    } catch (syncError) {
                        console.error('[Progress] Sync error:', syncError);
                        // Fallback: queue for later
                        await this.addToQueue({
                            type: 'MARK_WATCHED',
                            payload: { showId, seasonNumber, episodeNumber, rating }
                        });
                    }
                } else {
                    // Offline: queue for later
                    console.log('[Progress] Offline - queuing for later sync');
                    console.log('[Progress] Offline - streak will be updated when connection is restored');
                    await this.addToQueue({
                        type: 'MARK_WATCHED',
                        payload: { showId, seasonNumber, episodeNumber, rating }
                    });
                }
            }

            // 4. Check achievements (viewing and streak)
            if (userId !== 'guest') {
                console.log(`[Progress] Checking achievements for user: ${userId}`);
                try {
                    await achievementChecker.checkEpisodeAchievements(userId);
                    await achievementChecker.checkStreakAchievements(userId);
                } catch (achievementError) {
                    console.error('[Progress] Error checking achievements:', achievementError);
                    // Don't fail the main operation if achievement check fails
                }
            } else {
                console.log('[Progress] Skipping achievement check - user is guest');
            }

        } catch (error) {
            console.error('Error marking episode watched:', error);
        }
    }

    async markEpisodeUnwatched(showId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
        try {
            // 1. Optimistic Update
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const filtered = allProgress.filter(
                ep => !(ep.show_id === showId && ep.season_number === seasonNumber && ep.episode_number === episodeNumber)
            );

            await AsyncStorage.setItem(key, JSON.stringify(filtered));
            await this.updateShowProgressLocal(showId);

            // 2. Queue for Sync
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await this.addToQueue({
                    type: 'MARK_UNWATCHED',
                    payload: { showId, seasonNumber, episodeNumber }
                });
            }

        } catch (error) {
            console.error('Error marking episode unwatched:', error);
        }
    }

    async isEpisodeWatched(showId: number, seasonNumber: number, episodeNumber: number): Promise<boolean> {
        try {
            const progress = await this.getEpisodeProgress(showId);
            return progress.some(
                ep => ep.season_number === seasonNumber &&
                    ep.episode_number === episodeNumber &&
                    ep.watched
            );
        } catch (error) {
            console.error('Error checking episode watched status:', error);
            return false;
        }
    }

    // --- Show Progress Methods ---

    async getShowProgress(showId: number): Promise<ShowProgress | null> {
        try {
            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];
            return allProgress.find(sp => sp.show_id === showId) || null;
        } catch (error) {
            console.error('Error getting show progress:', error);
            return null;
        }
    }

    private async updateShowProgressLocal(showId: number): Promise<void> {
        console.log(`[Progress] updateShowProgressLocal called for showId: ${showId}`);
        try {
            const episodeProgress = await this.getEpisodeProgress(showId);
            const watchedEpisodes = episodeProgress.filter(ep => ep.watched);

            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            // Find existing progress
            const existingIndex = allProgress.findIndex(sp => sp.show_id === showId);
            const existing = existingIndex !== -1 ? allProgress[existingIndex] : null;

            // Remove existing entry for this show to replace it
            const otherShows = allProgress.filter(sp => sp.show_id !== showId);

            if (watchedEpisodes.length > 0) {
                // Find latest
                const latest = watchedEpisodes.reduce((prev, current) => {
                    if (current.season_number > prev.season_number) return current;
                    if (current.season_number === prev.season_number && current.episode_number > prev.episode_number) return current;
                    return prev;
                });

                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || 'guest';

                // Determine status
                let status: ShowProgress['status'] = existing?.status || 'watching';

                // Optimization: Only fetch details if we need to check completion
                // i.e., if not already completed/ended, or if we just watched a new episode
                const shouldCheckStatus = status !== 'completed' && status !== 'up_to_date';

                if (shouldCheckStatus) {
                    status = await this.determineShowStatus(showId, watchedEpisodes);
                    console.log(`[Progress] Determined status: ${status}`);
                    
                    // Check completion achievements when show is completed
                    if (status === 'completed' && userId !== 'guest') {
                        try {
                            await achievementChecker.checkCompletionAchievements(userId);
                        } catch (achievementError) {
                            console.error('Error checking completion achievements:', achievementError);
                        }
                    }
                }

                // Auto-add to watchlist if not present
                const inWatchlist = await storageService.isInWatchlist(showId, 'tv');
                if (!inWatchlist) {
                    try {
                        const showDetails = await tmdbService.getTVShowDetails(showId);
                        if (showDetails) {
                            await storageService.addToWatchlist({
                                id: showId,
                                type: 'tv',
                                title: showDetails.name,
                                poster_path: showDetails.poster_path,
                                first_air_date: showDetails.first_air_date,
                                vote_average: showDetails.vote_average,
                                watched: false,
                            });
                            console.log(`[Progress] Auto-added show ${showId} to watchlist.`);
                        }
                    } catch (err) {
                        console.error('Error auto-adding to watchlist:', err);
                    }
                }

                otherShows.push({
                    id: `${userId}-${showId}`,
                    user_id: userId,
                    show_id: showId,
                    current_season: latest.season_number,
                    current_episode: latest.episode_number,
                    total_watched_episodes: watchedEpisodes.length,
                    last_watched_date: latest.watched_date || new Date().toISOString(),
                    status: status
                });
            }

            await AsyncStorage.setItem(key, JSON.stringify(otherShows));
            console.log(`[Progress] Local update complete for show ${showId}`);

        } catch (error) {
            console.error('Error updating local show progress:', error);
        }
    }

    async getAllShowsProgress(): Promise<ShowProgress[]> {
        try {
            // Prioritize local storage as it contains optimistic updates
            const key = await this.getProgressKey('shows');
            const json = await AsyncStorage.getItem(key);

            if (json) {
                const allShows: ShowProgress[] = JSON.parse(json);
                return allShows;
            }

            // Fallback to Supabase if local is empty (e.g. first load on new device)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('show_progress')
                    .select('*')
                    .eq('user_id', user.id);

                if (!error && data) {
                    // Cache it locally for next time
                    await AsyncStorage.setItem(key, JSON.stringify(data));
                    return data as ShowProgress[];
                }
            }

            return [];
        } catch (error) {
            console.error('Error getting all shows progress:', error);
            return [];
        }
    }

    async getSeasonProgress(showId: number, seasonNumber: number): Promise<{ watched: number; total: number }> {
        try {
            const episodeProgress = await this.getEpisodeProgress(showId);
            const seasonEpisodes = episodeProgress.filter(ep => ep.season_number === seasonNumber && ep.watched);

            return {
                watched: seasonEpisodes.length,
                total: 0 // Caller should fill this in
            };
        } catch (error) {
            console.error('Error getting season progress:', error);
            return { watched: 0, total: 0 };
        }
    }

    async markEpisodesUpTo(showId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
        try {
            // 1. Optimistic Update
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || 'guest';
            const now = new Date().toISOString();

            // Filter out existing entries for this season that we are about to overwrite/add
            const otherEpisodes = allProgress.filter(ep =>
                !(ep.show_id === showId && ep.season_number === seasonNumber && ep.episode_number <= episodeNumber)
            );

            const newEntries: EpisodeProgress[] = [];
            for (let i = 1; i <= episodeNumber; i++) {
                newEntries.push({
                    id: `${userId}-${showId}-${seasonNumber}-${i}`,
                    user_id: userId,
                    show_id: showId,
                    season_number: seasonNumber,
                    episode_number: i,
                    watched: true,
                    watched_date: now
                });
            }

            const updatedProgress = [...otherEpisodes, ...newEntries];
            await AsyncStorage.setItem(key, JSON.stringify(updatedProgress));
            await this.updateShowProgressLocal(showId);

            // 2. Queue for Sync (Bulk) and update streak
            if (userId !== 'guest') {
                // Check if online
                const netInfo = await NetInfo.fetch();
                
                if (netInfo.isConnected) {
                    // Sync directly to Supabase
                    try {
                        const updates = [];
                        for (let i = 1; i <= episodeNumber; i++) {
                            updates.push({
                                user_id: userId,
                                show_id: showId,
                                season_number: seasonNumber,
                                episode_number: i,
                                watched: true,
                                watched_date: now,
                                updated_at: now
                            });
                        }
                        
                        const { error } = await supabase.from('episode_progress').upsert(updates, {
                            onConflict: 'user_id, show_id, season_number, episode_number'
                        });
                        
                        if (error) {
                            console.error('[Progress] Error syncing batch episodes:', error);
                            // Fallback to queue
                            for (let i = 1; i <= episodeNumber; i++) {
                                await this.addToQueue({
                                    type: 'MARK_WATCHED',
                                    payload: { showId, seasonNumber, episodeNumber: i }
                                });
                            }
                        } else {
                            console.log(`[Progress] ✅ Batch synced ${episodeNumber} episodes`);
                            
                            // Update streak after batch sync
                            try {
                                await userActivityService.updateStreak(userId);
                                console.log('[Progress] ✅ Streak updated after batch watch');
                            } catch (streakError) {
                                console.error('[Progress] Error updating streak:', streakError);
                            }
                        }
                    } catch (syncError) {
                        console.error('[Progress] Batch sync error:', syncError);
                        // Fallback to queue
                        for (let i = 1; i <= episodeNumber; i++) {
                            await this.addToQueue({
                                type: 'MARK_WATCHED',
                                payload: { showId, seasonNumber, episodeNumber: i }
                            });
                        }
                    }
                } else {
                    // Offline: queue for later
                    console.log('[Progress] Offline - queuing batch episodes for later sync');
                    for (let i = 1; i <= episodeNumber; i++) {
                        await this.addToQueue({
                            type: 'MARK_WATCHED',
                            payload: { showId, seasonNumber, episodeNumber: i }
                        });
                    }
                }
            }

            // 3. Check achievements (viewing and streak)
            if (userId !== 'guest') {
                try {
                    await achievementChecker.checkEpisodeAchievements(userId);
                    await achievementChecker.checkStreakAchievements(userId);
                } catch (achievementError) {
                    console.error('Error checking achievements:', achievementError);
                }
            }

        } catch (error) {
            console.error('Error marking episodes up to:', error);
        }
    }

    async getNextEpisodeToWatch(showId: number): Promise<any | null> {
        try {
            const showDetails = await tmdbService.getTVShowDetails(showId);
            if (!showDetails) return null;

            const episodeProgress = await this.getEpisodeProgress(showId);
            const watchedEpisodes = episodeProgress.filter(ep => ep.watched);

            // If no episodes watched, return S1E1
            if (watchedEpisodes.length === 0) {
                const s1 = showDetails.seasons?.find(s => s.season_number === 1);
                if (s1) {
                    return {
                        season_number: 1,
                        episode_number: 1,
                        name: 'Episode 1',
                        overview: '',
                        air_date: s1.air_date,
                        still_path: null,
                        vote_average: 0
                    };
                }
                return null;
            }

            // Find the latest watched episode
            const latestWatched = watchedEpisodes.reduce((prev, current) => {
                if (current.season_number > prev.season_number) return current;
                if (current.season_number === prev.season_number && current.episode_number > prev.episode_number) return current;
                return prev;
            });

            // Check if there is a next episode in the same season
            const currentSeason = showDetails.seasons?.find(s => s.season_number === latestWatched.season_number);
            if (currentSeason && latestWatched.episode_number < currentSeason.episode_count) {
                // Fetch details for the next episode to get air_date
                const nextEpDetails = await tmdbService.getEpisodeDetails(showId, latestWatched.season_number, latestWatched.episode_number + 1);
                if (nextEpDetails) return nextEpDetails;

                // Fallback if details fetch fails
                return {
                    season_number: latestWatched.season_number,
                    episode_number: latestWatched.episode_number + 1,
                    // Other fields might be missing in fallback
                };
            }

            // Check if there is a next season
            const nextSeason = showDetails.seasons?.find(s => s.season_number === latestWatched.season_number + 1);
            if (nextSeason) {
                // Fetch details for the first episode of next season
                const nextEpDetails = await tmdbService.getEpisodeDetails(showId, nextSeason.season_number, 1);
                if (nextEpDetails) return nextEpDetails;

                return {
                    season_number: nextSeason.season_number,
                    episode_number: 1,
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting next episode to watch:', error);
            return null;
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Batch query for next episodes
     * Fetches next episodes for multiple shows in ONE operation instead of N queries
     */
    async getNextEpisodesForShows(showIds: number[]): Promise<Map<number, { season: number; episode: number }>> {
        const result = new Map<number, { season: number; episode: number }>();
        
        if (showIds.length === 0) return result;

        try {
            // Get all episode progress for these shows from local cache
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];
            
            // Group by show
            const progressByShow = new Map<number, EpisodeProgress[]>();
            allProgress.forEach(ep => {
                if (showIds.includes(ep.show_id) && ep.watched) {
                    if (!progressByShow.has(ep.show_id)) {
                        progressByShow.set(ep.show_id, []);
                    }
                    progressByShow.get(ep.show_id)!.push(ep);
                }
            });

            // For each show, calculate next episode
            for (const showId of showIds) {
                const watchedEpisodes = progressByShow.get(showId) || [];
                
                // If no episodes watched, next is S1E1
                if (watchedEpisodes.length === 0) {
                    result.set(showId, { season: 1, episode: 1 });
                    continue;
                }

                // Find latest watched
                const latestWatched = watchedEpisodes.reduce((prev, current) => {
                    if (current.season_number > prev.season_number) return current;
                    if (current.season_number === prev.season_number && current.episode_number > prev.episode_number) return current;
                    return prev;
                });

                // Next episode is simply latest + 1 (we'll validate against show details if needed)
                // For performance, we assume next episode exists and let the UI handle edge cases
                result.set(showId, {
                    season: latestWatched.season_number,
                    episode: latestWatched.episode_number + 1
                });
            }

            return result;
        } catch (error) {
            console.error('Error getting next episodes for shows:', error);
            return result;
        }
    }

    async markEpisodesBatch(showId: number, seasonNumber: number, episodeNumbers: number[]): Promise<void> {
        console.log(`[Progress] markEpisodesBatch called for showId: ${showId}, S${seasonNumber}, count: ${episodeNumbers.length}`);
        try {
            if (episodeNumbers.length === 0) return;

            // 1. Optimistic Update
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || 'guest';
            const now = new Date().toISOString();

            // Remove existing entries for these episodes to replace them
            const filtered = allProgress.filter(ep =>
                !(ep.show_id === showId && ep.season_number === seasonNumber && episodeNumbers.includes(ep.episode_number))
            );

            const newEntries = episodeNumbers.map(epNum => ({
                id: `${userId}-${showId}-${seasonNumber}-${epNum}`,
                user_id: userId,
                show_id: showId,
                season_number: seasonNumber,
                episode_number: epNum,
                watched: true,
                watched_date: now
            }));

            const updatedProgress = [...filtered, ...newEntries];
            await AsyncStorage.setItem(key, JSON.stringify(updatedProgress));
            await this.updateShowProgressLocal(showId);

            // 2. Queue for Sync
            if (userId !== 'guest') {
                await this.addToQueue({
                    type: 'MARK_BATCH_WATCHED',
                    payload: { showId, seasonNumber, episodeNumbers }
                });
            }

            // 3. Check achievements (viewing and streak)
            if (userId !== 'guest') {
                try {
                    await achievementChecker.checkEpisodeAchievements(userId);
                    await achievementChecker.checkStreakAchievements(userId);
                } catch (achievementError) {
                    console.error('Error checking achievements:', achievementError);
                }
            }

        } catch (error) {
            console.error('Error marking episodes batch:', error);
        }
    }
}

export const progressService = new ProgressService();