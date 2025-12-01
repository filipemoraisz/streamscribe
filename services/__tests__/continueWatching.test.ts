import { continueWatchingService } from '../continueWatching';
import { progressService } from '../progress';
import { tmdbService } from '../tmdb';

// Mock dependencies
jest.mock('../progress');
jest.mock('../tmdb');

// Mock NetInfo (required by progress service)
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(),
}));

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } })),
    },
  },
}));

describe('ContinueWatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContinueWatching', () => {
    it('returns empty array when no progress exists', async () => {
      // Mock empty progress
      (progressService.getAllShowsProgress as jest.Mock).mockResolvedValue([]);

      const result = await continueWatchingService.getContinueWatching();

      expect(result).toEqual([]);
    });

    it('returns TV shows with partial progress using batch method', async () => {
      // Mock show progress
      const mockShowProgress = [
        {
          id: 'test-user-id-1',
          user_id: 'test-user-id',
          show_id: 1,
          current_season: 1,
          current_episode: 5,
          total_watched_episodes: 5,
          last_watched_date: '2024-01-15T10:00:00.000Z',
          status: 'watching',
        },
      ];

      const mockShowDetails = {
        id: 1,
        name: 'Test Show',
        poster_path: '/test.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.5,
        number_of_episodes: 10,
      };

      // Mock batch next episodes method
      const mockNextEpisodesMap = new Map([[1, { season: 1, episode: 6 }]]);

      (progressService.getAllShowsProgress as jest.Mock).mockResolvedValue(mockShowProgress);
      (progressService.getNextEpisodesForShows as jest.Mock).mockResolvedValue(mockNextEpisodesMap);
      (tmdbService.getTVShowDetails as jest.Mock).mockResolvedValue(mockShowDetails);

      const result = await continueWatchingService.getContinueWatching();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        type: 'tv',
        title: 'Test Show',
        progress: 50, // 5/10 episodes
        nextEpisode: {
          season: 1,
          episode: 6,
          name: 'S1E6', // Generic name from batch method
        },
      });
      
      // Verify batch method was called
      expect(progressService.getNextEpisodesForShows).toHaveBeenCalledWith([1]);
    });

    it('sorts items by most recently watched', async () => {
      // Mock multiple shows with different watch dates
      const mockShowProgress = [
        {
          id: 'test-user-id-1',
          user_id: 'test-user-id',
          show_id: 1,
          current_season: 1,
          current_episode: 5,
          total_watched_episodes: 5,
          last_watched_date: '2024-01-10T10:00:00.000Z', // Older
          status: 'watching',
        },
        {
          id: 'test-user-id-2',
          user_id: 'test-user-id',
          show_id: 2,
          current_season: 2,
          current_episode: 3,
          total_watched_episodes: 15,
          last_watched_date: '2024-01-15T10:00:00.000Z', // Newer
          status: 'watching',
        },
      ];

      const mockShowDetails1 = {
        id: 1,
        name: 'Show 1',
        poster_path: '/test1.jpg',
        backdrop_path: '/backdrop1.jpg',
        vote_average: 8.5,
        number_of_episodes: 10,
      };

      const mockShowDetails2 = {
        id: 2,
        name: 'Show 2',
        poster_path: '/test2.jpg',
        backdrop_path: '/backdrop2.jpg',
        vote_average: 9.0,
        number_of_episodes: 20,
      };

      // Mock batch next episodes method
      const mockNextEpisodesMap = new Map([
        [1, { season: 1, episode: 6 }],
        [2, { season: 2, episode: 4 }],
      ]);

      (progressService.getAllShowsProgress as jest.Mock).mockResolvedValue(mockShowProgress);
      (progressService.getNextEpisodesForShows as jest.Mock).mockResolvedValue(mockNextEpisodesMap);
      (tmdbService.getTVShowDetails as jest.Mock)
        .mockResolvedValueOnce(mockShowDetails1)
        .mockResolvedValueOnce(mockShowDetails2);

      const result = await continueWatchingService.getContinueWatching();

      expect(result).toHaveLength(2);
      // Most recent should be first
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('excludes completed shows without next episode', async () => {
      const mockShowProgress = [
        {
          id: 'test-user-id-1',
          user_id: 'test-user-id',
          show_id: 1,
          current_season: 1,
          current_episode: 10,
          total_watched_episodes: 10,
          last_watched_date: '2024-01-15T10:00:00.000Z',
          status: 'completed',
        },
      ];

      // Completed shows are filtered out by status before batch call
      (progressService.getAllShowsProgress as jest.Mock).mockResolvedValue(mockShowProgress);

      const result = await continueWatchingService.getContinueWatching();

      // Should be empty because status is 'completed', not 'watching' or 'up_to_date'
      expect(result).toHaveLength(0);
    });

    it('handles errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (progressService.getAllShowsProgress as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await continueWatchingService.getContinueWatching();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ContinueWatching] Error getting continue watching items:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('skips shows that fail to load details', async () => {
      const mockShowProgress = [
        {
          id: 'test-user-id-1',
          user_id: 'test-user-id',
          show_id: 1,
          current_season: 1,
          current_episode: 5,
          total_watched_episodes: 5,
          last_watched_date: '2024-01-15T10:00:00.000Z',
          status: 'watching',
        },
        {
          id: 'test-user-id-2',
          user_id: 'test-user-id',
          show_id: 2,
          current_season: 1,
          current_episode: 3,
          total_watched_episodes: 3,
          last_watched_date: '2024-01-14T10:00:00.000Z',
          status: 'watching',
        },
      ];

      const mockShowDetails = {
        id: 2,
        name: 'Show 2',
        poster_path: '/test2.jpg',
        backdrop_path: '/backdrop2.jpg',
        vote_average: 9.0,
        number_of_episodes: 10,
      };

      (progressService.getAllShowsProgress as jest.Mock).mockResolvedValue(mockShowProgress);
      (tmdbService.getTVShowDetails as jest.Mock)
        .mockResolvedValueOnce(null) // First show fails
        .mockResolvedValueOnce(mockShowDetails); // Second show succeeds
      (progressService.getNextEpisodeToWatch as jest.Mock)
        .mockResolvedValue({ season_number: 1, episode_number: 4, name: 'Episode 4' });

      const result = await continueWatchingService.getContinueWatching();

      // Should only include the second show
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });
});
