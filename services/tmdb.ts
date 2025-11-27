import { API_CONFIG } from '../constants/Config';
import { Episode, Genre, Movie, Season, StreamingOption, TMDBWatchProvider, TMDBWatchProvidersResponse, TVShow, TVShowDetails } from '../types';
import { supabase } from './supabase';

class TMDBService {
  private baseURL = API_CONFIG.TMDB_BASE_URL;
  private apiKey = API_CONFIG.TMDB_API_KEY;

  private async fetchFromTMDB(endpoint: string): Promise<any> {
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${this.baseURL}${endpoint}${separator}api_key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`TMDB API error: ${response.status}, falling back to mock data`);
        return this.getMockData(endpoint);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('TMDB API request failed, falling back to mock data:', error);
      return this.getMockData(endpoint);
    }
  }

  private getMockData(endpoint: string, query?: string): any {
    // Generate unique IDs to avoid React key conflicts
    const generateUniqueId = (baseId: number) => baseId + Date.now() % 10000;

    const createMockMovie = (baseId: number, title: string) => ({
      id: generateUniqueId(baseId),
      title,
      overview: `This is ${title}. Please configure your TMDB API key in constants/Config.ts to see real data.`,
      poster_path: null,
      backdrop_path: null,
      release_date: '2024-01-01',
      vote_average: 7.5 + (baseId * 0.1),
      vote_count: 1000 + (baseId * 100),
      genre_ids: [28, 12],
      adult: false,
      original_language: 'en',
      original_title: title,
      popularity: 100 + (baseId * 10),
      video: false,
    });

    const createMockTVShow = (baseId: number, name: string) => ({
      id: generateUniqueId(baseId + 1000),
      name,
      overview: `This is ${name}. Please configure your TMDB API key in constants/Config.ts to see real data.`,
      poster_path: null,
      backdrop_path: null,
      first_air_date: '2024-01-01',
      vote_average: 8.0 + (baseId * 0.1),
      vote_count: 500 + (baseId * 50),
      genre_ids: [18, 10765],
      origin_country: ['US'],
      original_language: 'en',
      original_name: name,
      popularity: 80 + (baseId * 5),
    });

    const createMockTVShowDetails = (baseId: number, name: string) => ({
      ...createMockTVShow(baseId, name),
      seasons: [
        {
          id: generateUniqueId(baseId + 2000),
          name: 'Season 1',
          overview: `First season of ${name}`,
          season_number: 1,
          episode_count: 10,
          air_date: '2024-01-01',
          poster_path: null,
        },
        {
          id: generateUniqueId(baseId + 2001),
          name: 'Season 2',
          overview: `Second season of ${name}`,
          season_number: 2,
          episode_count: 12,
          air_date: '2024-06-01',
          poster_path: null,
        },
      ],
      number_of_seasons: 2,
      number_of_episodes: 22,
      episode_run_time: [45],
      status: 'Returning Series',
      type: 'Scripted',
      last_air_date: '2024-08-01',
    });

    // Handle search endpoints
    if (endpoint.includes('/search/multi')) {
      const searchResults = [
        { ...createMockMovie(1001, `Action Movie (${query})`), media_type: 'movie' },
        { ...createMockTVShow(2001, `Drama Series (${query})`), media_type: 'tv' },
        { ...createMockMovie(1002, `Comedy Movie (${query})`), media_type: 'movie' },
        { ...createMockTVShow(2002, `Sci-Fi Series (${query})`), media_type: 'tv' },
      ];
      return {
        results: searchResults
      };
    }

    // Handle TV show details endpoint
    if (endpoint.match(/^\/tv\/\d+$/)) {
      return createMockTVShowDetails(2001, 'Sample TV Show');
    }

    // Handle season details endpoint
    if (endpoint.match(/^\/tv\/\d+\/season\/\d+$/)) {
      const seasonMatch = endpoint.match(/\/season\/(\d+)$/);
      const seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : 1;
      return {
        id: generateUniqueId(3000 + seasonNumber),
        name: `Season ${seasonNumber}`,
        overview: `This is season ${seasonNumber} of the show.`,
        season_number: seasonNumber,
        episode_count: 10,
        air_date: '2024-01-01',
        poster_path: null,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: generateUniqueId(4000 + (seasonNumber * 100) + i),
          name: `Episode ${i + 1}`,
          overview: `This is episode ${i + 1} of season ${seasonNumber}.`,
          episode_number: i + 1,
          season_number: seasonNumber,
          air_date: '2024-01-01',
          runtime: 45,
          still_path: null,
          vote_average: 7.5 + (i * 0.1),
          vote_count: 100 + (i * 10),
        })),
      };
    }

    // Handle episode details endpoint
    if (endpoint.match(/^\/tv\/\d+\/season\/\d+\/episode\/\d+$/)) {
      const episodeMatch = endpoint.match(/\/season\/(\d+)\/episode\/(\d+)$/);
      const seasonNumber = episodeMatch ? parseInt(episodeMatch[1]) : 1;
      const episodeNumber = episodeMatch ? parseInt(episodeMatch[2]) : 1;
      return {
        id: generateUniqueId(4000 + (seasonNumber * 100) + episodeNumber),
        name: `Episode ${episodeNumber}`,
        overview: `This is episode ${episodeNumber} of season ${seasonNumber}.`,
        episode_number: episodeNumber,
        season_number: seasonNumber,
        air_date: '2024-01-01',
        runtime: 45,
        still_path: null,
        vote_average: 7.5 + (episodeNumber * 0.1),
        vote_count: 100 + (episodeNumber * 10),
      };
    }

    // Handle watch providers endpoints
    if (endpoint.includes('/watch/providers')) {
      return {
        id: 12345,
        results: {
          US: {
            link: 'https://www.themoviedb.org',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/9A1JSVmSxsyaBK4SUFsYVqbAYfW.jpg',
                provider_id: 8,
                provider_name: 'Netflix'
              },
              {
                display_priority: 2,
                logo_path: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg',
                provider_id: 9,
                provider_name: 'Amazon Prime Video'
              }
            ],
            buy: [
              {
                display_priority: 10,
                logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',
                provider_id: 2,
                provider_name: 'Apple TV'
              }
            ],
            rent: [
              {
                display_priority: 11,
                logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',
                provider_id: 2,
                provider_name: 'Apple TV'
              }
            ]
          }
        }
      };
    }

    // Handle different endpoints with unique data
    if (endpoint.includes('/tv/') || endpoint.includes('tv')) {
      return {
        results: [
          createMockTVShow(2001, 'Sample Drama Series'),
          createMockTVShow(2002, 'Sample Comedy Series'),
          createMockTVShow(2003, 'Sample Thriller Series'),
          createMockTVShow(2004, 'Sample Sci-Fi Series'),
          createMockTVShow(2005, 'Sample Mystery Series'),
        ]
      };
    } else {
      return {
        results: [
          createMockMovie(1001, 'Sample Action Movie'),
          createMockMovie(1002, 'Sample Comedy Movie'),
          createMockMovie(1003, 'Sample Drama Movie'),
          createMockMovie(1004, 'Sample Thriller Movie'),
          createMockMovie(1005, 'Sample Adventure Movie'),
        ]
      };
    }
  }

  // Movies
  async getTrendingMovies(): Promise<Movie[]> {
    const data = await this.fetchFromTMDB('/trending/movie/week');
    return data.results;
  }

  async getPopularMovies(): Promise<Movie[]> {
    const data = await this.fetchFromTMDB('/movie/popular');
    return data.results;
  }

  async getTopRatedMovies(): Promise<Movie[]> {
    const data = await this.fetchFromTMDB('/movie/top_rated');
    return data.results;
  }

  async getUpcomingMovies(): Promise<Movie[]> {
    const data = await this.fetchFromTMDB('/movie/upcoming');
    return data.results;
  }

  async getNowPlayingMovies(): Promise<Movie[]> {
    const data = await this.fetchFromTMDB('/movie/now_playing');
    return data.results;
  }

  async getMovieDetails(movieId: number): Promise<Movie> {
    return this.fetchFromTMDB(`/movie/${movieId}`);
  }

  // TV Shows
  async getTrendingTVShows(): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB('/trending/tv/week');
    return data.results;
  }

  async getPopularTVShows(): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB('/tv/popular');
    return data.results;
  }

  async getTopRatedTVShows(): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB('/tv/top_rated');
    return data.results;
  }

  async getAiringTodayTVShows(): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB('/tv/airing_today');
    return data.results;
  }

  async getOnTheAirTVShows(): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB('/tv/on_the_air');
    return data.results;
  }

  async getTVShowDetails(tvId: number): Promise<TVShowDetails> {
    return this.fetchFromTMDB(`/tv/${tvId}`);
  }

  async getSeasonDetails(tvId: number, seasonNumber: number): Promise<Season> {
    return this.fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
  }

  async getEpisodeDetails(tvId: number, seasonNumber: number, episodeNumber: number): Promise<Episode> {
    return this.fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
  }

  // Search
  async searchMovies(query: string): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}`);
    return data.results;
  }

  async searchTVShows(query: string): Promise<TVShow[]> {
    const data = await this.fetchFromTMDB(`/search/tv?query=${encodeURIComponent(query)}`);
    return data.results;
  }

  async searchMulti(query: string): Promise<(Movie | TVShow)[]> {
    const data = await this.fetchFromTMDB(`/search/multi?query=${encodeURIComponent(query)}`);
    const filtered = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
    return filtered;
  }

  // Genres
  async getMovieGenres(): Promise<Genre[]> {
    const data = await this.fetchFromTMDB('/genre/movie/list');
    return data.genres;
  }

  async getTVGenres(): Promise<Genre[]> {
    const data = await this.fetchFromTMDB('/genre/tv/list');
    return data.genres;
  }

  // Watch Providers
  async getMovieWatchProviders(movieId: number): Promise<TMDBWatchProvidersResponse> {
    return this.fetchFromTMDB(`/movie/${movieId}/watch/providers`);
  }

  async getTVWatchProviders(tvId: number): Promise<TMDBWatchProvidersResponse> {
    return this.fetchFromTMDB(`/tv/${tvId}/watch/providers`);
  }

  async getWatchProviders(id: number, type: 'movie' | 'tv', countryCode: string = 'PT'): Promise<StreamingOption[]> {
    try {
      const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

      // 1. Check Supabase Cache
      const { data: cloudCache } = await supabase
        .from('media_cache')
        .select('availability_data, last_updated')
        .eq('tmdb_id', id)
        .eq('media_type', type)
        .single();

      let fullResults: any = null;

      if (cloudCache) {
        const lastUpdated = new Date(cloudCache.last_updated).getTime();
        if (Date.now() - lastUpdated < CACHE_DURATION) {
          // Check if cache is in new format (raw TMDB object) or old format (array)
          if (cloudCache.availability_data && !Array.isArray(cloudCache.availability_data)) {
            fullResults = cloudCache.availability_data;
          }
        }
      }

      // 2. Fetch from API if no valid cache
      if (!fullResults) {
        const data = type === 'movie'
          ? await this.getMovieWatchProviders(id)
          : await this.getTVWatchProviders(id);

        fullResults = data.results || {};

        // 3. Save to Supabase Cache (Save FULL results)
        if (Object.keys(fullResults).length > 0) {
          await supabase.from('media_cache').upsert({
            tmdb_id: id,
            media_type: type,
            availability_data: fullResults,
            last_updated: new Date().toISOString()
          }, { onConflict: 'tmdb_id, media_type' });
        }
      }

      // 4. Process results for requested country
      const countryProviders = fullResults[countryCode];
      if (!countryProviders) {
        return [];
      }

      const options: StreamingOption[] = [];

      // Process different provider types
      const processProviders = (providers: TMDBWatchProvider[], providerType: 'flatrate' | 'buy' | 'rent' | 'free') => {
        providers?.forEach(provider => {
          options.push({
            service: {
              id: provider.provider_id.toString(),
              name: provider.provider_name,
              imageSet: {
                darkThemeImage: this.getProviderLogoURL(provider.logo_path),
                lightThemeImage: this.getProviderLogoURL(provider.logo_path),
                whiteImage: this.getProviderLogoURL(provider.logo_path),
              },
            },
            type: providerType,
            link: countryProviders.link,
          });
        });
      };

      // Add all available provider types
      if (countryProviders.flatrate) processProviders(countryProviders.flatrate, 'flatrate');
      if (countryProviders.buy) processProviders(countryProviders.buy, 'buy');
      if (countryProviders.rent) processProviders(countryProviders.rent, 'rent');
      if (countryProviders.free) processProviders(countryProviders.free, 'free');

      // Sort by display priority (lower number = higher priority)
      return options.sort((a, b) => {
        const aProvider = [...(countryProviders.flatrate || []), ...(countryProviders.buy || []), ...(countryProviders.rent || []), ...(countryProviders.free || [])]
          .find(p => p.provider_id.toString() === a.service.id);
        const bProvider = [...(countryProviders.flatrate || []), ...(countryProviders.buy || []), ...(countryProviders.rent || []), ...(countryProviders.free || [])]
          .find(p => p.provider_id.toString() === b.service.id);

        return (aProvider?.display_priority || 999) - (bProvider?.display_priority || 999);
      });

    } catch (error) {
      console.error('Error fetching watch providers:', error);
      return this.getMockWatchProviders();
    }
  }

  private getMockWatchProviders(): StreamingOption[] {
    return [
      {
        service: {
          id: '8',
          name: 'Netflix',
        },
        type: 'flatrate',
        link: 'https://www.themoviedb.org',
      },
      {
        service: {
          id: '9',
          name: 'Amazon Prime Video',
        },
        type: 'flatrate',
        link: 'https://www.themoviedb.org',
      },
      {
        service: {
          id: '337',
          name: 'Disney Plus',
        },
        type: 'flatrate',
        link: 'https://www.themoviedb.org',
      },
    ];
  }

  // Utility
  getImageURL(path: string | null, size: string = 'w500'): string | null {
    if (!path) return null;
    return `${API_CONFIG.TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }

  getProviderLogoURL(logoPath: string | null): string {
    if (!logoPath) return 'https://via.placeholder.com/92x92/333333/FFFFFF?text=?';
    return `${API_CONFIG.TMDB_IMAGE_BASE_URL}/w92${logoPath}`;
  }
  async getNextEpisode(tvId: number, lastSeason: number, lastEpisode: number): Promise<{ season: number; episode: number } | null> {
    try {
      const details = await this.getTVShowDetails(tvId);

      // If no progress (0, 0), return S1E1
      if (lastSeason === 0 && lastEpisode === 0) {
        const season1 = details.seasons.find(s => s.season_number === 1);
        return season1 && season1.episode_count > 0 ? { season: 1, episode: 1 } : null;
      }

      const currentSeason = details.seasons.find(s => s.season_number === lastSeason);

      if (currentSeason) {
        if (lastEpisode < currentSeason.episode_count) {
          return { season: lastSeason, episode: lastEpisode + 1 };
        } else {
          // Check next season
          // Find the next season number (might not be sequential if specials exist or gaps)
          // But usually sequential.
          const nextSeason = details.seasons.find(s => s.season_number === lastSeason + 1);
          if (nextSeason && nextSeason.episode_count > 0) {
            return { season: lastSeason + 1, episode: 1 };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting next episode:', error);
      return null;
    }
  }
}

export const tmdbService = new TMDBService();