import AsyncStorage from '@react-native-async-storage/async-storage';
import { EpisodeProgress, ShowProgress } from '../types';

class ProgressService {
    private async getProgressKey(type: 'episodes' | 'shows'): Promise<string> {
        try {
            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;
            return user ? `streamscribe_${type}_progress_${user.id}` : `streamscribe_${type}_progress_guest`;
        } catch (error) {
            console.error('Error getting progress key:', error);
            return `streamscribe_${type}_progress_guest`;
        }
    }

    // Episode Progress Methods
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
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return;

            const existingIndex = allProgress.findIndex(
                ep => ep.show_id === showId &&
                    ep.season_number === seasonNumber &&
                    ep.episode_number === episodeNumber &&
                    ep.user_id === user.id
            );

            const episodeProgress: EpisodeProgress = {
                id: existingIndex >= 0 ? allProgress[existingIndex].id : `${user.id}-${showId}-${seasonNumber}-${episodeNumber}`,
                user_id: user.id,
                show_id: showId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                watched: true,
                watched_date: new Date().toISOString(),
                rating,
            };

            if (existingIndex >= 0) {
                allProgress[existingIndex] = episodeProgress;
            } else {
                allProgress.push(episodeProgress);
            }

            await AsyncStorage.setItem(key, JSON.stringify(allProgress));

            // Update show progress
            await this.updateShowProgress(showId);
        } catch (error) {
            console.error('Error marking episode watched:', error);
        }
    }

    async markEpisodeUnwatched(showId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
        try {
            const key = await this.getProgressKey('episodes');
            const data = await AsyncStorage.getItem(key);
            const allProgress: EpisodeProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return;

            const filteredProgress = allProgress.filter(
                ep => !(ep.show_id === showId &&
                    ep.season_number === seasonNumber &&
                    ep.episode_number === episodeNumber &&
                    ep.user_id === user.id)
            );

            await AsyncStorage.setItem(key, JSON.stringify(filteredProgress));

            // Update show progress
            await this.updateShowProgress(showId);
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

    // Show Progress Methods
    async getShowProgress(showId: number): Promise<ShowProgress | null> {
        try {
            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return null;

            return allProgress.find(sp => sp.show_id === showId && sp.user_id === user.id) || null;
        } catch (error) {
            console.error('Error getting show progress:', error);
            return null;
        }
    }

    private async updateShowProgress(showId: number): Promise<void> {
        try {
            const episodeProgress = await this.getEpisodeProgress(showId);
            const watchedEpisodes = episodeProgress.filter(ep => ep.watched);

            if (watchedEpisodes.length === 0) return;

            // Find the latest watched episode
            const latestEpisode = watchedEpisodes.reduce((latest, current) => {
                if (current.season_number > latest.season_number) return current;
                if (current.season_number === latest.season_number && current.episode_number > latest.episode_number) return current;
                return latest;
            });

            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return;

            const existingIndex = allProgress.findIndex(sp => sp.show_id === showId && sp.user_id === user.id);

            const showProgress: ShowProgress = {
                id: existingIndex >= 0 ? allProgress[existingIndex].id : `${user.id}-${showId}`,
                user_id: user.id,
                show_id: showId,
                current_season: latestEpisode.season_number,
                current_episode: latestEpisode.episode_number,
                total_watched_episodes: watchedEpisodes.length,
                last_watched_date: latestEpisode.watched_date || new Date().toISOString(),
                status: 'watching',
            };

            if (existingIndex >= 0) {
                allProgress[existingIndex] = showProgress;
            } else {
                allProgress.push(showProgress);
            }

            await AsyncStorage.setItem(key, JSON.stringify(allProgress));
        } catch (error) {
            console.error('Error updating show progress:', error);
        }
    }

    async updateShowStatus(showId: number, status: ShowProgress['status']): Promise<void> {
        try {
            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return;

            const existingIndex = allProgress.findIndex(sp => sp.show_id === showId && sp.user_id === user.id);

            if (existingIndex >= 0) {
                allProgress[existingIndex].status = status;
                await AsyncStorage.setItem(key, JSON.stringify(allProgress));
            }
        } catch (error) {
            console.error('Error updating show status:', error);
        }
    }

    async getSeasonProgress(showId: number, seasonNumber: number): Promise<{ watched: number; total: number }> {
        try {
            const episodeProgress = await this.getEpisodeProgress(showId);
            const seasonEpisodes = episodeProgress.filter(ep => ep.season_number === seasonNumber);
            const watchedCount = seasonEpisodes.filter(ep => ep.watched).length;

            return {
                watched: watchedCount,
                total: seasonEpisodes.length,
            };
        } catch (error) {
            console.error('Error getting season progress:', error);
            return { watched: 0, total: 0 };
        }
    }

    async getAllShowsProgress(): Promise<ShowProgress[]> {
        try {
            const key = await this.getProgressKey('shows');
            const data = await AsyncStorage.getItem(key);
            const allProgress: ShowProgress[] = data ? JSON.parse(data) : [];

            const userData = await AsyncStorage.getItem('streamscribe_current_user');
            const user = userData ? JSON.parse(userData) : null;

            if (!user) return [];

            return allProgress.filter(sp => sp.user_id === user.id);
        } catch (error) {
            console.error('Error getting all shows progress:', error);
            return [];
        }
    }
}

export const progressService = new ProgressService();