import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { EpisodeProgress, ShowProgress } from '../types';
import { supabase } from './supabase';

type OfflineAction =
    | { type: 'MARK_WATCHED'; payload: { showId: number; seasonNumber: number; episodeNumber: number; rating?: number } }
    | { type: 'MARK_UNWATCHED'; payload: { showId: number; seasonNumber: number; episodeNumber: number } };

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
                    }
                } catch (err) {
                    console.error('Failed to sync action:', action, err);
                    remainingQueue.push(action); // Keep failed actions
                }
            }

            // Update queue with remaining items
            await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remainingQueue));

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
            // Note: In a real app, we might want to recalculate this on the server via a trigger
            // For now, we'll recalculate locally based on episodes to keep it simple and robust
            const showIds = new Set(episodes?.map(e => e.show_id));
            const showProgressList: ShowProgress[] = [];

            for (const showId of showIds) {
                const showEpisodes = episodes!.filter(e => e.show_id === showId && e.watched);
                if (showEpisodes.length === 0) continue;

                // Find latest
                const latest = showEpisodes.reduce((prev, current) => {
                    if (current.season_number > prev.season_number) return current;
                    if (current.season_number === prev.season_number && current.episode_number > prev.episode_number) return current;
                    return prev;
                });

                showProgressList.push({
                    id: `${user.id}-${showId}`,
                    user_id: user.id,
                    show_id: showId,
                    current_season: latest.season_number,
                    current_episode: latest.episode_number,
                    total_watched_episodes: showEpisodes.length,
                    last_watched_date: latest.watched_date || new Date().toISOString(),
                    status: 'watching' // Default, can be updated separately
                });
            }

            const showKey = await this.getProgressKey('shows');
            await AsyncStorage.setItem(showKey, JSON.stringify(showProgressList));

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

            // 2. Queue for Sync
            if (userId !== 'guest') {
                await this.addToQueue({
                    type: 'MARK_WATCHED',
                    payload: { showId, seasonNumber, episodeNumber, rating }
                });
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

            // Filter by showId (key already includes user context)
            return allProgress.find(sp => sp.show_id === showId) || null;
        } catch (error) {
            console.error('Error getting show progress:', error);
            return null;
        }
    }

    private async updateShowProgressLocal(showId: number): Promise<void> {
        try {
            const episodeProgress = await this.getEpisodeProgress(showId);
            const watchedEpisodes = episodeProgress.filter(ep => ep.watched);

            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            // Remove existing entry for this show
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

                otherShows.push({
                    id: `${userId}-${showId}`,
                    user_id: userId,
                    show_id: showId,
                    current_season: latest.season_number,
                    current_episode: latest.episode_number,
                    total_watched_episodes: watchedEpisodes.length,
                    last_watched_date: latest.watched_date || new Date().toISOString(),
                    status: 'watching'
                });
            }

            await AsyncStorage.setItem(key, JSON.stringify(otherShows));

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

            // Note: We don't know 'total' episodes in a season just from progress.
            // The UI usually passes the total count or we fetch it from TMDB.
            // Here we just return what we know.
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
            // Actually, we want to keep entries for episodes > episodeNumber
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

            // 2. Queue for Sync (Bulk)
            if (userId !== 'guest') {
                // For simplicity, we'll just queue individual actions for now. 
                // A better approach would be a bulk API endpoint.
                for (let i = 1; i <= episodeNumber; i++) {
                    await this.addToQueue({
                        type: 'MARK_WATCHED',
                        payload: { showId, seasonNumber, episodeNumber: i }
                    });
                }
            }

        } catch (error) {
            console.error('Error marking episodes up to:', error);
        }
    }
}

export const progressService = new ProgressService();