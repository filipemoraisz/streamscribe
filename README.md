# StreamScribe - TV Shows & Movies Tracker

A modern React Native app built with Expo for tracking TV shows and movies. Features a bold, minimalistic design with black/grey backgrounds and orange accents, integrating with TMDB API for content data and RapidAPI's Streaming Availability service for streaming information.

## Features

- **User Authentication**: Register and login with email/password
- **User Profiles**: Manage your personal profile information
- **Browse Content**: Discover trending and popular movies and TV shows
- **Search**: Find specific movies and TV shows with real-time search
- **Personal Watchlist**: Add items to your personal watchlist and mark them as watched
- **Streaming Info**: See where content is available to stream
- **User-Specific Data**: Each user has their own watchlist and preferences
- **Clean Design**: Bold, minimalistic interface with dark theme and orange accents

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. API Configuration

You'll need to obtain API keys for the following services:

#### TMDB API
1. Go to [The Movie Database (TMDB)](https://www.themoviedb.org/settings/api)
2. Create an account and request an API key
3. Copy your API key

#### RapidAPI Streaming Availability
1. Go to [RapidAPI Streaming Availability](https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability)
2. Subscribe to the API (free tier available)
3. Copy your RapidAPI key

#### Update Configuration
Open `constants/Config.ts` and replace the placeholder values:

```typescript
export const API_CONFIG = {
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
  TMDB_API_KEY: 'YOUR_ACTUAL_TMDB_API_KEY', // Replace this
  STREAMING_API_BASE_URL: 'https://streaming-availability.p.rapidapi.com',
  STREAMING_API_KEY: 'YOUR_ACTUAL_RAPIDAPI_KEY', // Replace this
};
```

### 3. Start the App

```bash
npx expo start
```

Choose your preferred platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your device

## Project Structure

```
streamscribe/
├── app/                    # App screens and navigation
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home screen
│   │   ├── search.tsx     # Search screen
│   │   └── watchlist.tsx  # Watchlist screen
│   ├── details/           # Detail screens
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
│   ├── Logo.tsx          # App logo component
│   ├── MediaCard.tsx     # Movie/TV show card
│   ├── MediaSection.tsx  # Horizontal media sections
│   ├── SearchBar.tsx     # Search input component
│   └── StreamingOptions.tsx # Streaming availability display
├── constants/            # App constants
│   ├── Colors.ts         # Color theme
│   └── Config.ts         # API configuration
├── services/             # API services
│   ├── tmdb.ts          # TMDB API integration
│   ├── streaming.ts     # Streaming availability API
│   └── storage.ts       # Local storage for watchlist
└── types/               # TypeScript type definitions
    └── index.ts
```

## Key Features Explained

### Authentication
- **Login/Register**: Secure user authentication with email and password
- **User Profiles**: Edit personal information and manage account
- **Session Management**: Automatic login persistence and logout functionality

### Home Screen
- Displays trending and popular movies and TV shows
- Horizontal scrolling sections for easy browsing
- Quick access to search and watchlist functionality
- User-specific content recommendations

### Search
- Real-time search across movies and TV shows with debounced input
- Grid layout for search results
- Add to watchlist directly from search results
- Instant search feedback

### Watchlist
- Personal collection of saved movies and TV shows (user-specific)
- Filter by type (movies/TV) and watched status
- Mark items as watched/unwatched
- Persistent storage per user using AsyncStorage

### Details Screen
- Comprehensive information about movies and TV shows
- Streaming availability from multiple services
- Add/remove from watchlist
- High-quality backdrop and poster images

### Profile Management
- View and edit user profile information
- Account settings and preferences
- Secure logout functionality

### Design System
- **Colors**: Black/grey backgrounds with orange (#FF6600) accents
- **Typography**: Clean, readable fonts with proper hierarchy
- **Layout**: Minimalistic design with focus on content
- **Navigation**: Bottom tab navigation for easy access

## Technologies Used

- **React Native** with **Expo**
- **Expo Router** for navigation
- **TypeScript** for type safety
- **TMDB API** for movie and TV show data
- **RapidAPI Streaming Availability** for streaming information
- **AsyncStorage** for local data persistence
- **React Native SVG** for the custom logo

## Development

### Adding New Features
1. Create new components in the `components/` directory
2. Add new screens in the `app/` directory
3. Update types in `types/index.ts` as needed
4. Add new API services in the `services/` directory

### Customizing Design
- Update colors in `constants/Colors.ts`
- Modify component styles using StyleSheet
- The design follows a consistent dark theme with orange accents

## Troubleshooting

### API Issues
- Ensure your API keys are correctly set in `constants/Config.ts`
- Check that you have sufficient API quota
- Verify network connectivity

### Build Issues
- Clear Expo cache: `npx expo start --clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Expo CLI version: `npx expo --version`

## License

This project is for educational and personal use. Please respect the terms of service of the APIs used (TMDB and RapidAPI).