import { API_CONFIG } from '../constants/Config';
import { StreamingOption } from '../types';

class StreamingService {
  private baseURL = API_CONFIG.STREAMING_API_BASE_URL;
  private apiKey = API_CONFIG.STREAMING_API_KEY;

  private async fetchFromStreamingAPI(endpoint: string): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      throw new Error(`Streaming API error: ${response.status}`);
    }

    return response.json();
  }

  async getStreamingOptions(tmdbId: number, type: 'movie' | 'tv'): Promise<StreamingOption[]> {
    try {
      console.log('RapidAPI Key:', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'undefined');
      console.log('Making streaming API call for:', tmdbId, type);

      const endpoint = `/shows/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}`;
      const data = await this.fetchFromStreamingAPI(endpoint);

      if (!data.streamingOptions) {
        return [];
      }

      // Transform the API response to match our StreamingOption interface
      const options: StreamingOption[] = [];

      Object.entries(data.streamingOptions).forEach(([country, services]: [string, any]) => {
        if (country === 'us') { // Focus on US streaming options
          services.forEach((service: any) => {
            options.push({
              service: {
                id: service.service.id,
                name: service.service.name,
                homePage: service.service.homePage,
                themeColorCode: service.service.themeColorCode,
                imageSet: service.service.imageSet,
              },
              type: service.type,
              quality: service.quality || 'HD',
              price: service.price,
              link: service.link,
            });
          });
        }
      });

      return options;
    } catch (error) {
      console.error('Error fetching streaming options:', error);
      return [];
    }
  }

  private getMockStreamingOptions(): StreamingOption[] {
    return [
      {
        service: {
          id: 'netflix',
          name: 'Netflix',
          homePage: 'https://netflix.com',
          themeColorCode: '#E50914',
          imageSet: {
            lightThemeImage: 'https://via.placeholder.com/40x40/E50914/FFFFFF?text=N',
            darkThemeImage: 'https://via.placeholder.com/40x40/E50914/FFFFFF?text=N',
            whiteImage: 'https://via.placeholder.com/40x40/E50914/FFFFFF?text=N',
          },
        },
        type: 'flatrate',
        quality: 'HD',
        link: 'https://netflix.com',
      },
      {
        service: {
          id: 'amazon-prime',
          name: 'Amazon Prime Video',
          homePage: 'https://primevideo.com',
          themeColorCode: '#00A8E1',
          imageSet: {
            lightThemeImage: 'https://via.placeholder.com/40x40/00A8E1/FFFFFF?text=P',
            darkThemeImage: 'https://via.placeholder.com/40x40/00A8E1/FFFFFF?text=P',
            whiteImage: 'https://via.placeholder.com/40x40/00A8E1/FFFFFF?text=P',
          },
        },
        type: 'flatrate',
        quality: 'HD',
        link: 'https://primevideo.com',
      },
    ];
  }

  async searchByTitle(title: string, type: 'movie' | 'tv'): Promise<any> {
    try {
      const endpoint = `/shows/search/title?title=${encodeURIComponent(title)}&show_type=${type}`;
      return await this.fetchFromStreamingAPI(endpoint);
    } catch (error) {
      console.error('Error searching by title:', error);
      return null;
    }
  }
}

export const streamingService = new StreamingService();