/**
 * Contextual Messaging Service
 * 
 * Generates personalized messages based on time of day, day of week,
 * season, and user context to create engaging, mood-appropriate experiences.
 */

export interface ContextualMessage {
  message: string;
  emoji: string;
  suggestedGenres?: number[]; // TMDB genre IDs
  suggestedMood?: 'cozy' | 'energetic' | 'thoughtful' | 'fun' | 'relaxing' | 'intense';
}

export interface TimeContext {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  month: number; // 0 = January, 11 = December
  isWeekend: boolean;
  isHoliday?: boolean;
}

class ContextualMessagingService {
  /**
   * Get current time context
   */
  private getTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const month = now.getMonth();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      hour,
      dayOfWeek,
      month,
      isWeekend,
      isHoliday: this.isHolidayPeriod(month, now.getDate()),
    };
  }

  /**
   * Check if current date is in a holiday period
   */
  private isHolidayPeriod(month: number, day: number): boolean {
    // December (holiday season)
    if (month === 11 && day >= 15) return true;
    
    // January (New Year)
    if (month === 0 && day <= 7) return true;
    
    // October (Halloween season)
    if (month === 9 && day >= 20) return true;
    
    // February (Valentine's)
    if (month === 1 && day >= 10 && day <= 14) return true;
    
    return false;
  }

  /**
   * Get time of day period
   */
  private getTimeOfDay(hour: number): 'early-morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late-night' {
    if (hour >= 5 && hour < 8) return 'early-morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 24) return 'night';
    return 'late-night';
  }

  /**
   * Get season based on month
   */
  private getSeason(month: number): 'winter' | 'spring' | 'summer' | 'fall' {
    if (month >= 11 || month <= 1) return 'winter';
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    return 'fall';
  }

  /**
   * Generate contextual message based on current time and context
   */
  getContextualMessage(userStreak?: number): ContextualMessage {
    const context = this.getTimeContext();
    const timeOfDay = this.getTimeOfDay(context.hour);
    const season = this.getSeason(context.month);

    // Priority 1: Holiday-specific messages
    if (context.isHoliday) {
      return this.getHolidayMessage(context.month, context.dayOfWeek);
    }

    // Priority 2: Weekend-specific messages
    if (context.isWeekend) {
      return this.getWeekendMessage(timeOfDay, context.dayOfWeek);
    }

    // Priority 3: Weekday messages with time context
    return this.getWeekdayMessage(timeOfDay, context.dayOfWeek, season, userStreak);
  }

  /**
   * Holiday-specific messages
   */
  private getHolidayMessage(month: number, dayOfWeek: number): ContextualMessage {
    // December - Holiday Season
    if (month === 11) {
      return {
        message: "Cozy holiday vibes? Perfect time for feel-good classics 🎄",
        emoji: "🎄",
        suggestedGenres: [35, 10751, 10749], // Comedy, Family, Romance
        suggestedMood: 'cozy',
      };
    }

    // October - Halloween
    if (month === 9) {
      return {
        message: "Spooky season is here! Ready for some thrills? 🎃",
        emoji: "🎃",
        suggestedGenres: [27, 53, 9648], // Horror, Thriller, Mystery
        suggestedMood: 'intense',
      };
    }

    // February - Valentine's
    if (month === 1) {
      return {
        message: "Love is in the air! Time for romantic stories ❤️",
        emoji: "❤️",
        suggestedGenres: [10749, 35, 18], // Romance, Comedy, Drama
        suggestedMood: 'thoughtful',
      };
    }

    // January - New Year
    if (month === 0) {
      return {
        message: "New year, new stories! What's your first watch? ✨",
        emoji: "✨",
        suggestedGenres: [18, 878, 12], // Drama, Sci-Fi, Adventure
        suggestedMood: 'energetic',
      };
    }

    return this.getDefaultMessage();
  }

  /**
   * Weekend-specific messages
   */
  private getWeekendMessage(timeOfDay: string, dayOfWeek: number): ContextualMessage {
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    // Saturday Night - Prime time
    if (isSaturday && (timeOfDay === 'evening' || timeOfDay === 'night')) {
      return {
        message: "Saturday night vibes! Time to binge something epic 🍿",
        emoji: "🍿",
        suggestedGenres: [28, 12, 878, 14], // Action, Adventure, Sci-Fi, Fantasy
        suggestedMood: 'fun',
      };
    }

    // Saturday Day
    if (isSaturday && (timeOfDay === 'morning' || timeOfDay === 'afternoon')) {
      return {
        message: "Weekend mode activated! What's on your watchlist? 🎬",
        emoji: "🎬",
        suggestedGenres: [35, 10751, 16], // Comedy, Family, Animation
        suggestedMood: 'fun',
      };
    }

    // Sunday Evening - Relaxing
    if (isSunday && timeOfDay === 'evening') {
      return {
        message: "Sunday wind-down. Perfect for something cozy 🌙",
        emoji: "🌙",
        suggestedGenres: [18, 10749, 10402], // Drama, Romance, Music
        suggestedMood: 'cozy',
      };
    }

    // Sunday Day
    if (isSunday) {
      return {
        message: "Lazy Sunday? Great day for a movie marathon 📺",
        emoji: "📺",
        suggestedGenres: [35, 18, 10751], // Comedy, Drama, Family
        suggestedMood: 'relaxing',
      };
    }

    return this.getDefaultMessage();
  }

  /**
   * Weekday messages with time and season context
   */
  private getWeekdayMessage(
    timeOfDay: string,
    dayOfWeek: number,
    season: string,
    userStreak?: number
  ): ContextualMessage {
    // Monday Morning - Motivation
    if (dayOfWeek === 1 && timeOfDay === 'morning') {
      return {
        message: "New week, new episodes! Let's keep that streak going 💪",
        emoji: "💪",
        suggestedGenres: [35, 10759, 10765], // Comedy, Action & Adventure, Sci-Fi & Fantasy
        suggestedMood: 'energetic',
      };
    }

    // Friday Evening - TGIF
    if (dayOfWeek === 5 && (timeOfDay === 'evening' || timeOfDay === 'night')) {
      return {
        message: "Friday night! Time to unwind with something great 🎉",
        emoji: "🎉",
        suggestedGenres: [28, 35, 53], // Action, Comedy, Thriller
        suggestedMood: 'fun',
      };
    }

    // Late Night (any weekday)
    if (timeOfDay === 'late-night' || timeOfDay === 'early-morning') {
      return {
        message: "Night owl? Perfect time for a thriller or mystery 🦉",
        emoji: "🦉",
        suggestedGenres: [53, 9648, 80], // Thriller, Mystery, Crime
        suggestedMood: 'intense',
      };
    }

    // Evening (weekday)
    if (timeOfDay === 'evening') {
      return {
        message: "Evening unwind. What's calling your name tonight? 🌆",
        emoji: "🌆",
        suggestedGenres: [18, 35, 10749], // Drama, Comedy, Romance
        suggestedMood: 'relaxing',
      };
    }

    // Afternoon
    if (timeOfDay === 'afternoon') {
      return {
        message: "Afternoon break? Quick episode or movie time! ☕",
        emoji: "☕",
        suggestedGenres: [35, 10751, 99], // Comedy, Family, Documentary
        suggestedMood: 'relaxing',
      };
    }

    // Season-specific messages
    return this.getSeasonalMessage(season);
  }

  /**
   * Seasonal messages
   */
  private getSeasonalMessage(season: string): ContextualMessage {
    switch (season) {
      case 'winter':
        return {
          message: "Cozy winter vibes. Perfect for indoor binging 🔥",
          emoji: "🔥",
          suggestedGenres: [18, 10749, 10751], // Drama, Romance, Family
          suggestedMood: 'cozy',
        };

      case 'spring':
        return {
          message: "Spring energy! Time for fresh stories 🌸",
          emoji: "🌸",
          suggestedGenres: [10749, 35, 12], // Romance, Comedy, Adventure
          suggestedMood: 'energetic',
        };

      case 'summer':
        return {
          message: "Summer vibes! Adventure awaits 🌞",
          emoji: "🌞",
          suggestedGenres: [28, 12, 878], // Action, Adventure, Sci-Fi
          suggestedMood: 'fun',
        };

      case 'fall':
        return {
          message: "Autumn mood. Perfect for thoughtful stories 🍂",
          emoji: "🍂",
          suggestedGenres: [18, 9648, 36], // Drama, Mystery, History
          suggestedMood: 'thoughtful',
        };

      default:
        return this.getDefaultMessage();
    }
  }

  /**
   * Default fallback message
   */
  private getDefaultMessage(): ContextualMessage {
    return {
      message: "Ready to discover something amazing? 🎬",
      emoji: "🎬",
      suggestedGenres: [28, 35, 18], // Action, Comedy, Drama
      suggestedMood: 'fun',
    };
  }

  /**
   * Get streak-based motivational message (can override contextual message)
   */
  getStreakMessage(streak: number): ContextualMessage | null {
    if (streak === 0) {
      return {
        message: "Start your journey today! 🎬",
        emoji: "🎬",
        suggestedMood: 'energetic',
      };
    }

    if (streak === 7) {
      return {
        message: "One week strong! You're on fire! 🔥",
        emoji: "🔥",
        suggestedMood: 'energetic',
      };
    }

    if (streak === 30) {
      return {
        message: "30 days! You're a streaming legend! 👑",
        emoji: "👑",
        suggestedMood: 'fun',
      };
    }

    if (streak >= 100) {
      return {
        message: "Century club! Absolutely legendary! 🏆",
        emoji: "🏆",
        suggestedMood: 'fun',
      };
    }

    // For other streaks, return null to use contextual message
    return null;
  }
}

export const contextualMessagingService = new ContextualMessagingService();
