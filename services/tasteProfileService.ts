import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { TasteProfile, GenreScore, RecommendationItem, Movie, TVShow, GenreSection } from '../types';

class TasteProfileService {
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private profileCache: Map<string, { profile: TasteProfile; timestamp: number }> = new Map();

  /**
   * Build a comprehensive taste profile from user's watch history
   * Requirements: 3.4, 3.5
   */
  async buildTasteProfile(userId: string): Promise<TasteProfile> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.profile;
    }

    try {
      // For now, we'll build taste profile primarily from watchlist
      // In the future, we can add a proper watched_content table
      const watchedContent: any[] = [];

      // Query watchlist for ratings and preferences
      const { data: watchlistData, error: watchlistError } = await supabase
        .from('watchlists')
        .select('tmdb_id, media_type')
        .eq('user_id', userId);

      if (watchlistError) throw watchlistError;

      // For now, use empty recent activity
      // In the future, we can track this properly
      const recentActivity: any[] = [];

      // Fetch TMDB details for watched content to get genres and ratings
      const contentDetails = await this.fetchContentDetails(
        watchedContent || [],
        watchlistData || []
      );

      // Analyze genres
      const favoriteGenres = this.analyzeGenres(contentDetails);

      // Calculate average rating
      const averageRating = this.calculateAverageRating(contentDetails);

      // Calculate content type preference
      const contentTypePreference = this.calculateContentTypePreference(
        watchedContent || []
      );

      // Calculate watch frequency
      const watchFrequency = this.calculateWatchFrequency(recentActivity || []);

      // Get recently watched IDs
      const recentlyWatched = (watchedContent || [])
        .slice(0, 20)
        .map(item => item.content_id);

      // Get preferred providers from user preferences
      const { data: userPrefs } = await supabase
        .from('user_preferences')
        .select('subscribed_services')
        .eq('user_id', userId)
        .single();

      const preferredProviders = userPrefs?.subscribed_services || [];

      const profile: TasteProfile = {
        userId,
        favoriteGenres,
        averageRating,
        contentTypePreference,
        watchFrequency,
        recentlyWatched,
        preferredProviders,
      };

      // Cache the profile
      this.profileCache.set(userId, { profile, timestamp: Date.now() });

      return profile;
    } catch (error) {
      console.error('Error building taste profile:', error);
      // Return default profile on error
      return this.getDefaultProfile(userId);
    }
  }

  /**
   * Generate taste-based recommendations using TMDB API
   * Requirements: 3.6, 3.7
   */
  async generateTasteRecommendations(
    profile: TasteProfile,
    subscribedServices: string[],
    excludeIds: Set<string>,
    limit: number = 10
  ): Promise<RecommendationItem[]> {
    try {
      const recommendations: RecommendationItem[] = [];
      const seenIds = new Set<string>();

      // Get top 3 genres to query
      const topGenres = profile.favoriteGenres.slice(0, 3);

      if (topGenres.length === 0) {
        // Fallback to popular content if no genre data
        return this.getFallbackRecommendations(
          subscribedServices,
          excludeIds,
          limit
        );
      }

      // Query TMDB for each top genre
      for (const genreScore of topGenres) {
        if (recommendations.length >= limit) break;

        // Determine content type to fetch based on preference
        const shouldFetchMovies = profile.contentTypePreference.movie >= 0.3;
        const shouldFetchTV = profile.contentTypePreference.tv >= 0.3;

        // Fetch movies if preferred
        if (shouldFetchMovies) {
          const movies = await this.fetchMoviesByGenre(genreScore.genreId);
          const processedMovies = await this.processRecommendations(
            movies,
            'movie',
            profile,
            subscribedServices,
            excludeIds,
            seenIds
          );
          recommendations.push(...processedMovies);
        }

        // Fetch TV shows if preferred
        if (shouldFetchTV && recommendations.length < limit) {
          const tvShows = await this.fetchTVShowsByGenre(genreScore.genreId);
          const processedTV = await this.processRecommendations(
            tvShows,
            'tv',
            profile,
            subscribedServices,
            excludeIds,
            seenIds
          );
          recommendations.push(...processedTV);
        }
      }

      // Sort by taste score and return top results
      recommendations.sort((a, b) => (b.tasteScore || 0) - (a.tasteScore || 0));
      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Error generating taste recommendations:', error);
      return [];
    }
  }

  /**
   * Generate genre-based content sections from user's watch history
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async generateGenreSections(userId: string): Promise<GenreSection[]> {
    try {
      // Build taste profile to get genre preferences
      const profile = await this.buildTasteProfile(userId);

      // If no genre preferences, fall back to popular genres
      if (profile.favoriteGenres.length === 0) {
        return this.getPopularGenreSections();
      }

      // Get top 3 preferred genres
      const topGenres = profile.favoriteGenres.slice(0, 3);
      const sections: GenreSection[] = [];

      // Fetch content for each genre
      for (const genreScore of topGenres) {
        // Determine content type based on user preference
        const shouldFetchMovies = profile.contentTypePreference.movie >= 0.3;
        const shouldFetchTV = profile.contentTypePreference.tv >= 0.3;

        // Default to both if preferences are balanced
        const fetchMovies = shouldFetchMovies || profile.contentTypePreference.movie >= profile.contentTypePreference.tv;
        const fetchTV = shouldFetchTV || profile.contentTypePreference.tv > profile.contentTypePreference.movie;

        // Fetch movies for this genre
        if (fetchMovies) {
          const movies = await tmdbService.discoverMoviesByGenre(genreScore.genreId);
          if (movies.length > 0) {
            sections.push({
              genreId: genreScore.genreId,
              genreName: genreScore.genreName,
              items: movies.slice(0, 20), // Limit to 20 items per section
              type: 'movie',
            });
          }
        }

        // Fetch TV shows for this genre
        if (fetchTV && sections.length < 3) {
          const tvShows = await tmdbService.discoverTVShowsByGenre(genreScore.genreId);
          if (tvShows.length > 0) {
            sections.push({
              genreId: genreScore.genreId,
              genreName: genreScore.genreName,
              items: tvShows.slice(0, 20), // Limit to 20 items per section
              type: 'tv',
            });
          }
        }

        // Stop if we have 3 sections
        if (sections.length >= 3) break;
      }

      return sections;
    } catch (error) {
      console.error('Error generating genre sections:', error);
      // Fall back to popular genres on error
      return this.getPopularGenreSections();
    }
  }

  /**
   * Calculate how well content matches user's taste profile
   * Requirements: 3.6
   */
  calculateTasteScore(
    content: Movie | TVShow,
    profile: TasteProfile
  ): number {
    let score = 0;

    // Genre match (40% weight)
    const genreScore = this.calculateGenreMatchScore(content.genre_ids, profile);
    score += genreScore * 0.4;

    // Rating similarity (30% weight)
    const ratingScore = this.calculateRatingScore(content.vote_average, profile);
    score += ratingScore * 0.3;

    // Content type preference (20% weight)
    const contentType = 'title' in content ? 'movie' : 'tv';
    const typeScore = profile.contentTypePreference[contentType] * 100;
    score += typeScore * 0.2;

    // Recency score (10% weight) - newer content gets slight boost
    const recencyScore = this.calculateRecencyScore(content);
    score += recencyScore * 0.1;

    return Math.min(Math.round(score), 100);
  }

  // ===== Private Helper Methods =====

  private async fetchContentDetails(
    watchedContent: any[],
    watchlistData: any[]
  ): Promise<Array<{ genres: number[]; rating: number; type: 'movie' | 'tv' }>> {
    const details: Array<{ genres: number[]; rating: number; type: 'movie' | 'tv' }> = [];

    // Combine watched and watchlist content
    const allContent = [
      ...watchedContent.map(w => ({ id: w.content_id, type: w.content_type })),
      ...watchlistData.map(w => ({ id: w.tmdb_id, type: w.media_type })),
    ];

    // Deduplicate
    const uniqueContent = Array.from(
      new Map(allContent.map(item => [`${item.type}-${item.id}`, item])).values()
    );

    // Fetch details in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < Math.min(uniqueContent.length, 30); i += batchSize) {
      const batch = uniqueContent.slice(i, i + batchSize);
      const promises = batch.map(async item => {
        try {
          if (item.type === 'movie') {
            const movie = await tmdbService.getMovieDetails(item.id);
            return {
              genres: movie.genre_ids || [],
              rating: movie.vote_average,
              type: 'movie' as const,
            };
          } else {
            const tv = await tmdbService.getTVShowDetails(item.id);
            return {
              genres: tv.genre_ids || [],
              rating: tv.vote_average,
              type: 'tv' as const,
            };
          }
        } catch (error) {
          console.error(`Error fetching details for ${item.type} ${item.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      details.push(...results.filter((d): d is NonNullable<typeof d> => d !== null));
    }

    return details;
  }

  private analyzeGenres(
    contentDetails: Array<{ genres: number[]; rating: number; type: 'movie' | 'tv' }>
  ): GenreScore[] {
    const genreMap = new Map<number, { count: number; totalRating: number }>();

    contentDetails.forEach(content => {
      content.genres.forEach(genreId => {
        const existing = genreMap.get(genreId) || { count: 0, totalRating: 0 };
        genreMap.set(genreId, {
          count: existing.count + 1,
          totalRating: existing.totalRating + content.rating,
        });
      });
    });

    const genreScores: GenreScore[] = Array.from(genreMap.entries()).map(
      ([genreId, data]) => ({
        genreId,
        genreName: this.getGenreName(genreId),
        count: data.count,
        avgRating: data.totalRating / data.count,
      })
    );

    // Sort by count (frequency) and then by average rating
    genreScores.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.avgRating - a.avgRating;
    });

    return genreScores.slice(0, 10);
  }

  private calculateAverageRating(
    contentDetails: Array<{ genres: number[]; rating: number; type: 'movie' | 'tv' }>
  ): number {
    if (contentDetails.length === 0) return 7.0; // Default

    const sum = contentDetails.reduce((acc, content) => acc + content.rating, 0);
    return sum / contentDetails.length;
  }

  private calculateContentTypePreference(
    watchedContent: any[]
  ): { movie: number; tv: number } {
    if (watchedContent.length === 0) {
      return { movie: 0.5, tv: 0.5 }; // Default equal preference
    }

    const movieCount = watchedContent.filter(w => w.content_type === 'movie').length;
    const tvCount = watchedContent.filter(w => w.content_type === 'tv').length;
    const total = movieCount + tvCount;

    return {
      movie: total > 0 ? movieCount / total : 0.5,
      tv: total > 0 ? tvCount / total : 0.5,
    };
  }

  private calculateWatchFrequency(
    recentActivity: any[]
  ): { moviesPerWeek: number; episodesPerWeek: number } {
    const movieCount = recentActivity.filter(a => a.content_type === 'movie').length;
    const episodeCount = recentActivity.filter(a => a.content_type === 'tv').length;

    // Calculate per week (30 days = ~4.3 weeks)
    const weeks = 4.3;

    return {
      moviesPerWeek: movieCount / weeks,
      episodesPerWeek: episodeCount / weeks,
    };
  }

  private getDefaultProfile(userId: string): TasteProfile {
    return {
      userId,
      favoriteGenres: [],
      averageRating: 7.0,
      contentTypePreference: { movie: 0.5, tv: 0.5 },
      watchFrequency: { moviesPerWeek: 0, episodesPerWeek: 0 },
      recentlyWatched: [],
      preferredProviders: [],
    };
  }

  private async getFallbackRecommendations(
    subscribedServices: string[],
    excludeIds: Set<string>,
    limit: number
  ): Promise<RecommendationItem[]> {
    try {
      // Get popular content as fallback
      const [movies, tvShows] = await Promise.all([
        tmdbService.getPopularMovies(),
        tmdbService.getPopularTVShows(),
      ]);

      const combined = [
        ...movies.slice(0, 5).map(m => ({ ...m, type: 'movie' as const })),
        ...tvShows.slice(0, 5).map(t => ({ ...t, type: 'tv' as const })),
      ];

      const recommendations: RecommendationItem[] = [];

      for (const item of combined) {
        if (recommendations.length >= limit) break;

        const itemId = `${item.type}-${item.id}`;
        if (excludeIds.has(itemId)) continue;

        // Get streaming providers
        const providers = await tmdbService.getWatchProviders(item.id, item.type);
        const matchingProvider = providers.find(p =>
          subscribedServices.includes(p.service.id)
        );

        if (matchingProvider) {
          recommendations.push({
            id: item.id,
            type: item.type,
            title: item.type === 'movie' ? (item as any).title : (item as any).name,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            release_date: item.type === 'movie' ? (item as any).release_date : undefined,
            first_air_date: item.type === 'tv' ? (item as any).first_air_date : undefined,
            providerName: matchingProvider.service.name,
            providerLogoUrl: matchingProvider.service.imageSet?.darkThemeImage,
            source: 'taste',
            tasteScore: 50, // Neutral score for fallback
            genres: item.genre_ids,
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Error getting fallback recommendations:', error);
      return [];
    }
  }

  private async fetchMoviesByGenre(genreId: number): Promise<Movie[]> {
    try {
      // TMDB discover endpoint would be ideal, but using popular as fallback
      const movies = await tmdbService.getPopularMovies();
      return movies.filter(m => m.genre_ids.includes(genreId)).slice(0, 10);
    } catch (error) {
      console.error('Error fetching movies by genre:', error);
      return [];
    }
  }

  private async fetchTVShowsByGenre(genreId: number): Promise<TVShow[]> {
    try {
      const tvShows = await tmdbService.getPopularTVShows();
      return tvShows.filter(t => t.genre_ids.includes(genreId)).slice(0, 10);
    } catch (error) {
      console.error('Error fetching TV shows by genre:', error);
      return [];
    }
  }

  private async processRecommendations(
    content: (Movie | TVShow)[],
    type: 'movie' | 'tv',
    profile: TasteProfile,
    subscribedServices: string[],
    excludeIds: Set<string>,
    seenIds: Set<string>
  ): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];

    for (const item of content) {
      const itemId = `${type}-${item.id}`;

      // Skip if already excluded or seen
      if (excludeIds.has(itemId) || seenIds.has(itemId)) continue;
      seenIds.add(itemId);

      // Check if available on subscribed services
      const providers = await tmdbService.getWatchProviders(item.id, type);
      const matchingProvider = providers.find(p =>
        subscribedServices.includes(p.service.id)
      );

      if (!matchingProvider) continue;

      // Calculate taste score
      const tasteScore = this.calculateTasteScore(item, profile);

      recommendations.push({
        id: item.id,
        type,
        title: type === 'movie' ? (item as Movie).title : (item as TVShow).name,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: type === 'movie' ? (item as Movie).release_date : undefined,
        first_air_date: type === 'tv' ? (item as TVShow).first_air_date : undefined,
        providerName: matchingProvider.service.name,
        providerLogoUrl: matchingProvider.service.imageSet?.darkThemeImage,
        source: 'taste',
        tasteScore,
        genres: item.genre_ids,
      });
    }

    return recommendations;
  }

  private calculateGenreMatchScore(
    contentGenres: number[],
    profile: TasteProfile
  ): number {
    if (profile.favoriteGenres.length === 0) return 50; // Neutral score

    let matchScore = 0;
    let totalWeight = 0;

    profile.favoriteGenres.forEach((favoriteGenre, index) => {
      // Weight decreases for lower-ranked genres
      const weight = profile.favoriteGenres.length - index;
      totalWeight += weight;

      if (contentGenres.includes(favoriteGenre.genreId)) {
        matchScore += weight * 100;
      }
    });

    return totalWeight > 0 ? matchScore / totalWeight : 0;
  }

  private calculateRatingScore(contentRating: number, profile: TasteProfile): number {
    // Score based on how close the content rating is to user's average
    const difference = Math.abs(contentRating - profile.averageRating);

    // Perfect match = 100, 2+ points difference = 0
    if (difference === 0) return 100;
    if (difference >= 2) return 0;

    return 100 - (difference / 2) * 100;
  }

  private calculateRecencyScore(content: Movie | TVShow): number {
    const releaseDate =
      'release_date' in content ? content.release_date : content.first_air_date;

    if (!releaseDate) return 50; // Neutral score

    const releaseYear = new Date(releaseDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const yearDifference = currentYear - releaseYear;

    // Recent content (0-2 years) = 100
    // 3-5 years = 75
    // 6-10 years = 50
    // 10+ years = 25
    if (yearDifference <= 2) return 100;
    if (yearDifference <= 5) return 75;
    if (yearDifference <= 10) return 50;
    return 25;
  }

  private getGenreName(genreId: number): string {
    // Common TMDB genre IDs
    const genreMap: Record<number, string> = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Science Fiction',
      10770: 'TV Movie',
      53: 'Thriller',
      10752: 'War',
      37: 'Western',
      10759: 'Action & Adventure',
      10762: 'Kids',
      10763: 'News',
      10764: 'Reality',
      10765: 'Sci-Fi & Fantasy',
      10766: 'Soap',
      10767: 'Talk',
      10768: 'War & Politics',
    };

    return genreMap[genreId] || 'Unknown';
  }

  private async getPopularGenreSections(): Promise<GenreSection[]> {
    try {
      // Default popular genres: Action, Comedy, Drama
      const popularGenres = [
        { genreId: 28, genreName: 'Action' },
        { genreId: 35, genreName: 'Comedy' },
        { genreId: 18, genreName: 'Drama' },
      ];

      const sections: GenreSection[] = [];

      for (const genre of popularGenres) {
        // Fetch movies for this genre
        const movies = await tmdbService.discoverMoviesByGenre(genre.genreId);
        if (movies.length > 0) {
          sections.push({
            genreId: genre.genreId,
            genreName: genre.genreName,
            items: movies.slice(0, 20),
            type: 'movie',
          });
        }

        // Stop if we have 3 sections
        if (sections.length >= 3) break;
      }

      return sections;
    } catch (error) {
      console.error('Error getting popular genre sections:', error);
      return [];
    }
  }
}

export const tasteProfileService = new TasteProfileService();
