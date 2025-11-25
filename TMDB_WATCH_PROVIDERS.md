# TMDB Watch Providers Implementation

This document describes the implementation of TMDB's Watch Providers API to replace the previous streaming service.

## Overview

The app now uses TMDB's Watch Providers API (powered by JustWatch) to display streaming availability information. This provides more accurate and up-to-date streaming data directly from TMDB.

## API Endpoint

```
GET https://api.themoviedb.org/3/movie/{movie_id}/watch/providers
GET https://api.themoviedb.org/3/tv/{tv_id}/watch/providers
```

## Implementation Details

### 1. Updated Types (`types/index.ts`)

- Modified `StreamingOption` interface to support TMDB provider structure
- Added new TMDB-specific types: `TMDBWatchProvider`, `TMDBWatchProviders`, `TMDBWatchProvidersResponse`
- Changed provider types from `subscription` to `flatrate` to match TMDB terminology

### 2. Enhanced TMDB Service (`services/tmdb.ts`)

Added new methods:
- `getMovieWatchProviders(movieId)` - Get watch providers for movies
- `getTVWatchProviders(tvId)` - Get watch providers for TV shows  
- `getWatchProviders(id, type)` - Unified method that returns formatted streaming options
- `getProviderLogoURL(logoPath)` - Helper to construct provider logo URLs

### 3. Updated StreamingOptions Component (`components/StreamingOptions.tsx`)

- Updated to handle TMDB provider data structure
- Added JustWatch attribution as required by TMDB
- Improved provider logo handling using TMDB's logo URLs
- Updated type labels to match TMDB terminology

### 4. Updated Details Screen (`app/details/[type]/[id].tsx`)

- Replaced `streamingService.getStreamingOptions()` calls with `tmdbService.getWatchProviders()`
- Removed dependency on the old streaming service

## Provider Types

TMDB uses the following provider types:
- `flatrate` - Subscription services (Netflix, Disney+, etc.)
- `buy` - Purchase options (Apple TV, Google Play, etc.)
- `rent` - Rental options (Apple TV, Amazon Video, etc.)
- `free` - Free streaming options (with ads)

## JustWatch Attribution

As required by TMDB, the component includes attribution text:
"Streaming data powered by JustWatch"

This links to JustWatch's website and acknowledges their partnership with TMDB.

## Country Support

Currently configured for US providers (`results.US`), but can be easily modified to support other countries by changing the country code in the `getWatchProviders` method.

## Fallback Behavior

- If TMDB API is unavailable, the service falls back to mock data
- If no providers are found, displays "No streaming options available"
- Provider logos fall back to placeholder images if not available

## Testing

Use the included `test-tmdb-providers.js` script to test the API directly:

```bash
node test-tmdb-providers.js
```

## Benefits

1. **More Accurate Data**: Direct integration with TMDB's curated provider data
2. **Better Performance**: Eliminates dependency on third-party streaming APIs
3. **Consistent Branding**: Uses official provider logos from TMDB
4. **Proper Attribution**: Includes required JustWatch attribution
5. **Simplified Architecture**: Reduces external API dependencies

## Example Response

```json
{
  "id": 155,
  "results": {
    "US": {
      "link": "https://www.themoviedb.org/movie/155-the-dark-knight/watch?locale=US",
      "flatrate": [
        {
          "display_priority": 1,
          "logo_path": "/9A1JSVmSxsyaBK4SUFsYVqbAYfW.jpg",
          "provider_id": 8,
          "provider_name": "Netflix"
        }
      ],
      "buy": [
        {
          "display_priority": 2,
          "logo_path": "/peURlLlr8jggOwK53fJ5wdQl05y.jpg",
          "provider_id": 2,
          "provider_name": "Apple TV"
        }
      ]
    }
  }
}
```