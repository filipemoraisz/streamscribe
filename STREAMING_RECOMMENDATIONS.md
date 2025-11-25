# Streaming Service Recommendations Feature

This document describes the intelligent streaming service recommendation system that analyzes user watchlists to suggest optimal monthly subscriptions.

## Overview

The recommendation system analyzes a user's watchlist and suggests which streaming services would provide the best value each month based on available content, estimated savings, and viewing patterns.

## Core Components

### 1. Recommendation Service (`services/recommendations.ts`)

The main service that generates monthly recommendations by:
- Analyzing user's unwatched watchlist items
- Fetching streaming availability for each item via TMDB Watch Providers API
- Calculating value scores based on content availability and subscription costs
- Generating reasoning and savings estimates

#### Key Methods:
- `generateMonthlyRecommendations()` - Main method that returns monthly analysis
- `getProviderDetails(providerId)` - Get provider information and pricing
- Private scoring methods for content recency and value calculation

### 2. Recommendation Screen (`app/(tabs)/recommendations.tsx`)

Main UI screen that displays:
- Monthly summary with coverage percentage and estimated savings
- Ranked list of recommended streaming services
- Interactive provider cards with detailed information
- Empty states for users without watchlist items

### 3. Recommendation Card (`components/RecommendationCard.tsx`)

Individual provider recommendation display showing:
- Provider logo and name with ranking (gold/silver/bronze)
- Content statistics (total items, movies, TV shows)
- Value score and estimated savings
- Key reasoning points for the recommendation

### 4. Provider Details Modal (`components/ProviderDetailsModal.tsx`)

Detailed view when tapping a provider recommendation:
- Complete provider statistics
- Full reasoning explanation
- List of all available watchlist content
- Direct navigation to content details

### 5. Recommendation Banner (`components/RecommendationBanner.tsx`)

Home screen notification banner that:
- Alerts users to new recommendations
- Provides quick access to recommendations tab
- Can be dismissed by users

## Recommendation Algorithm

### Scoring System

Each provider receives a score based on:

1. **Content Availability** (40% weight)
   - Number of watchlist items available
   - Mix of movies vs TV shows

2. **Content Quality** (30% weight)
   - Average TMDB rating of available content
   - Popularity scores

3. **Content Recency** (20% weight)
   - Recently released content scores higher
   - Sliding scale: <6 months (1.0), <12 months (0.8), <24 months (0.6), older (0.4)

4. **Value Proposition** (10% weight)
   - Estimated savings vs individual rentals
   - Subscription cost vs content value

### Provider Costs

Built-in monthly subscription costs (USD):
- Netflix: $15.49
- Amazon Prime Video: $14.98
- Disney Plus: $13.99
- HBO Max: $15.99
- Hulu: $14.99
- Apple TV+: $6.99
- And more...

### Savings Calculation

Estimated savings = (Number of items × $3.99 rental cost) - Monthly subscription cost

## Features

### Monthly Analysis
- **Coverage Percentage**: How much of watchlist is covered by top 3 providers
- **Estimated Savings**: Potential monthly savings vs individual rentals
- **Provider Count**: Number of services analyzed

### Smart Reasoning
Each recommendation includes contextual reasoning:
- "5 items from your watchlist available"
- "Mix of 3 movies and 2 shows"
- "Great value - save ~$25 vs individual rentals"

### Interactive Experience
- Tap provider cards for detailed breakdown
- View all available content from watchlist
- Navigate directly to content details
- Refresh recommendations based on watchlist changes

## Integration Points

### TMDB Watch Providers API
- Uses existing TMDB integration for streaming availability
- Focuses on US providers (configurable for other regions)
- Handles API failures gracefully with mock data

### Watchlist Integration
- Analyzes only unwatched items
- Updates automatically when watchlist changes
- Considers user's viewing history and preferences

### Navigation Integration
- New "Recommendations" tab in main navigation
- Deep linking from home screen banner
- Seamless navigation to content details

## User Experience Flow

1. **User adds items to watchlist** via search/browse
2. **System analyzes availability** across streaming services
3. **Monthly recommendations generated** with scoring and reasoning
4. **User receives notification** via home screen banner
5. **User explores recommendations** with detailed breakdowns
6. **User can view specific content** available on each service

## Benefits

### For Users
- **Save Money**: Identify best value streaming subscriptions
- **Reduce Decision Fatigue**: Clear recommendations with reasoning
- **Maximize Content**: Ensure chosen services have desired content
- **Stay Updated**: Monthly refresh based on new releases and watchlist changes

### For App
- **Increased Engagement**: Regular reason to return to app
- **Watchlist Growth**: Incentivizes adding more content
- **User Retention**: Valuable monthly utility
- **Data Insights**: Understanding of user preferences and viewing patterns

## Future Enhancements

### Planned Features
1. **Multi-Region Support**: Recommendations for different countries
2. **Seasonal Analysis**: Holiday/summer viewing pattern adjustments
3. **Family Plans**: Consider shared subscriptions and family viewing
4. **Price Tracking**: Alert users to subscription price changes
5. **Bundle Recommendations**: Suggest service bundles for better value
6. **Viewing History Integration**: Factor in actual viewing patterns
7. **Social Features**: Share recommendations with friends/family

### Technical Improvements
1. **Real-time Pricing**: Integration with provider APIs for current pricing
2. **Machine Learning**: Improve scoring algorithm based on user feedback
3. **Caching Strategy**: Optimize performance for large watchlists
4. **Push Notifications**: Alert users to new recommendations
5. **A/B Testing**: Experiment with different recommendation strategies

## Configuration

### Provider Costs
Update `PROVIDER_COSTS` in `RecommendationService` to reflect current pricing.

### Scoring Weights
Adjust scoring algorithm weights in the recommendation generation logic.

### Regional Settings
Modify country code in `getWatchProviders` method for different regions.

## Testing

The system includes comprehensive error handling:
- API failures fall back to mock data
- Empty watchlists show appropriate messaging
- Network issues display retry options
- Invalid data is filtered out gracefully

## Analytics Opportunities

Track user engagement with:
- Recommendation view rates
- Provider detail modal opens
- Content navigation from recommendations
- Watchlist additions after viewing recommendations
- Actual subscription decisions (if integrated with providers)

This feature transforms the app from a simple content browser into a valuable monthly utility that helps users make informed streaming decisions and save money.