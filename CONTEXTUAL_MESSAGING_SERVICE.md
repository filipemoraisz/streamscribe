# Contextual Messaging Service

A smart messaging system that generates personalized, context-aware messages based on time of day, day of week, season, holidays, and user behavior.

## Overview

The Contextual Messaging Service creates engaging, mood-appropriate messages that make the app feel alive and responsive to the user's real-world context.

## Features

### 🕐 Time-Based Messages
Messages adapt to the time of day:
- **Early Morning (5-8am)**: Energizing start-of-day messages
- **Morning (8am-12pm)**: Productive, motivational vibes
- **Afternoon (12-5pm)**: Quick break suggestions
- **Evening (5-9pm)**: Unwind and relax messages
- **Night (9pm-12am)**: Prime binge-watching time
- **Late Night (12-5am)**: Night owl content for insomniacs

### 📅 Day-Based Messages
Special messages for different days:
- **Monday**: Motivational, new week energy
- **Friday**: TGIF celebration vibes
- **Saturday**: Weekend fun and binge-worthy content
- **Sunday**: Lazy day relaxation

### 🎄 Holiday-Specific Messages
Seasonal and holiday-aware:
- **December (15-31)**: Cozy holiday classics
- **October (20-31)**: Spooky Halloween thrills
- **February (10-14)**: Romantic Valentine's content
- **January (1-7)**: New year, fresh starts

### 🍂 Seasonal Vibes
Messages adapt to the season:
- **Winter**: Cozy indoor binging
- **Spring**: Fresh, energetic stories
- **Summer**: Adventure and action
- **Fall**: Thoughtful, atmospheric content

### 🔥 Streak Milestones
Special messages for achievement moments:
- Day 0: Welcome message
- Day 7: One week celebration
- Day 30: Monthly milestone
- Day 100+: Legend status

## Message Examples

### Weekend Messages
```
"Saturday night vibes! Time to binge something epic 🍿"
"Lazy Sunday? Great day for a movie marathon 📺"
"Sunday wind-down. Perfect for something cozy 🌙"
```

### Time-Based Messages
```
"Evening unwind. What's calling your name tonight? 🌆"
"Night owl? Perfect time for a thriller or mystery 🦉"
"Friday night! Time to unwind with something great 🎉"
```

### Holiday Messages
```
"Cozy holiday vibes? Perfect time for feel-good classics 🎄"
"Spooky season is here! Ready for some thrills? 🎃"
"Love is in the air! Time for romantic stories ❤️"
```

### Seasonal Messages
```
"Cozy winter vibes. Perfect for indoor binging 🔥"
"Summer vibes! Adventure awaits 🌞"
"Autumn mood. Perfect for thoughtful stories 🍂"
```

## Genre Recommendations

Each message includes suggested genres (TMDB genre IDs) that match the mood:

### Mood Categories
- **Cozy**: Drama, Romance, Family (18, 10749, 10751)
- **Energetic**: Action, Adventure, Sci-Fi (28, 12, 878)
- **Fun**: Comedy, Action, Animation (35, 28, 16)
- **Relaxing**: Drama, Comedy, Documentary (18, 35, 99)
- **Intense**: Thriller, Horror, Mystery (53, 27, 9648)
- **Thoughtful**: Drama, Mystery, History (18, 9648, 36)

## Usage

### Basic Usage
```typescript
import { contextualMessagingService } from '@/services/contextualMessaging';

// Get contextual message
const message = contextualMessagingService.getContextualMessage(userStreak);

console.log(message.message); // "Saturday night vibes! Time to binge something epic 🍿"
console.log(message.emoji); // "🍿"
console.log(message.suggestedGenres); // [28, 12, 878]
console.log(message.suggestedMood); // "fun"
```

### Check for Streak Milestones
```typescript
// Check if there's a special streak message
const streakMessage = contextualMessagingService.getStreakMessage(30);

if (streakMessage) {
  console.log(streakMessage.message); // "30 days! You're a streaming legend! 👑"
}
```

### In Components
```typescript
const contextualMessage = useMemo(() => {
  // Priority: Streak milestones
  const streakMessage = contextualMessagingService.getStreakMessage(stats.currentStreak);
  if (streakMessage) {
    return streakMessage.message;
  }

  // Otherwise: Contextual message
  const message = contextualMessagingService.getContextualMessage(stats.currentStreak);
  return message.message;
}, [stats.currentStreak]);
```

## Future Enhancements

### Potential Additions
1. **Weather Integration**: "Rainy day? Perfect for indoor binging ☔"
2. **User Mood Selection**: Let users manually set their mood
3. **Watch History Analysis**: "You loved thrillers last week..."
4. **Social Context**: "Your friends are watching..."
5. **Event-Based**: Sports events, award shows, premieres
6. **Location-Based**: Time zone awareness, regional holidays
7. **Personalization**: Learn user preferences over time

### Advanced Features
- A/B testing different message styles
- User feedback on message relevance
- Machine learning for message optimization
- Multi-language support
- Custom message templates per user

## Integration Points

### Current Integration
- ✅ **AtAGlanceHero Component**: Footer message

### Potential Integrations
- **Home Screen Header**: Welcome message
- **Push Notifications**: Time-based reminders
- **Empty States**: Contextual suggestions when no content
- **Search Suggestions**: Mood-based search prompts
- **Recommendation Sections**: Dynamic section titles

## Technical Details

### Message Priority
1. **Streak Milestones** (highest priority)
2. **Holiday-Specific Messages**
3. **Weekend Messages**
4. **Weekday + Time Messages**
5. **Seasonal Messages** (fallback)

### Time Context Detection
- Uses device local time
- Automatically detects day of week
- Calculates season from month
- Identifies holiday periods

### Performance
- Lightweight calculations (no API calls)
- Memoized in components
- Instant message generation
- No external dependencies

## Examples in Action

### Monday Morning (9am)
```
"New week, new episodes! Let's keep that streak going 💪"
Genres: Comedy, Action & Adventure, Sci-Fi & Fantasy
Mood: energetic
```

### Saturday Night (10pm)
```
"Saturday night vibes! Time to binge something epic 🍿"
Genres: Action, Adventure, Sci-Fi, Fantasy
Mood: fun
```

### December Evening (7pm)
```
"Cozy holiday vibes? Perfect time for feel-good classics 🎄"
Genres: Comedy, Family, Romance
Mood: cozy
```

### Late Night (2am)
```
"Night owl? Perfect time for a thriller or mystery 🦉"
Genres: Thriller, Mystery, Crime
Mood: intense
```

---

**This service makes the app feel alive, personal, and contextually aware - creating a more engaging user experience!** 🎬✨
