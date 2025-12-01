import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { LeavingSoonItem } from '../types';
import { MediaCard } from './MediaCard';
import { SkeletonLoader } from './SkeletonLoader';
import { ErrorState } from './ErrorState';

interface LeavingSoonSectionProps {
  items: LeavingSoonItem[];
  onItemPress: (item: LeavingSoonItem) => void;
  onWatchlistPress: (item: LeavingSoonItem) => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * LeavingSoonSection Component
 * 
 * Displays content leaving streaming services soon with departure dates and warning badges.
 * 
 * Requirements:
 * - 10.1: Display "Leaving Soon" section for content leaving within 30 days
 * - 10.2: Show departure date for each item
 * - 10.3: Sort by earliest departure date (soonest first)
 * - 10.4: Show warning badge for watchlist items
 * - 10.5: Hide section when no content leaving soon
 */
export const LeavingSoonSection: React.FC<LeavingSoonSectionProps> = ({
  items,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
  loading = false,
  error = null,
  onRetry,
}) => {
  /**
   * Format departure date for display (e.g., "Dec 15, 2025")
   */
  const formatDepartureDate = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return dateString;
    }
  };

  /**
   * Get urgency color based on days remaining
   */
  const getUrgencyColor = (daysRemaining: number): string => {
    if (daysRemaining <= 7) return '#FF4444'; // Red for urgent (1 week or less)
    if (daysRemaining <= 14) return '#FF9500'; // Orange for soon (2 weeks or less)
    return '#FFD700'; // Yellow for later (more than 2 weeks)
  };

  /**
   * Format days remaining text
   */
  const formatDaysRemaining = (daysRemaining: number): string => {
    if (daysRemaining === 0) return 'Leaving today';
    if (daysRemaining === 1) return '1 day left';
    return `${daysRemaining} days left`;
  };

  const renderItem = ({ item }: { item: LeavingSoonItem }) => {
    const formattedDate = formatDepartureDate(item.departureDate);
    const urgencyColor = getUrgencyColor(item.daysRemaining);
    const daysText = formatDaysRemaining(item.daysRemaining);
    const inWatchlist = item.isInWatchlist || isInWatchlist(item.id);

    return (
      <View style={styles.cardWrapper}>
        <MediaCard
          item={item as any}
          type={item.type}
          onPress={() => onItemPress(item)}
          onWatchlistPress={() => onWatchlistPress(item)}
          isInWatchlist={inWatchlist}
          style={styles.card}
        />
        
        {/* Departure date and days remaining */}
        <View style={styles.infoContainer}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>Leaving</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
            <Text style={styles.urgencyText}>{daysText}</Text>
          </View>
        </View>

        {/* Warning badge for watchlist items - Requirement 10.4 */}
        {inWatchlist && (
          <View style={styles.watchlistWarning}>
            <Text style={styles.watchlistWarningText}>⚠️ In Your Watchlist</Text>
          </View>
        )}

        {/* Provider name */}
        {item.providerName && (
          <Text style={styles.providerText}>on {item.providerName}</Text>
        )}
      </View>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaving Soon</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaving Soon</Text>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  // Requirement 10.5: Hide section when no content leaving soon
  if (items.length === 0) {
    return null;
  }

  // Render content
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Leaving Soon</Text>
        <Text style={styles.subtitle}>Watch before they're gone!</Text>
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerContainer: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  cardWrapper: {
    marginRight: 12,
    width: 140,
  },
  card: {
    width: 140,
  },
  infoContainer: {
    marginTop: 8,
  },
  dateContainer: {
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  urgencyText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  watchlistWarning: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  watchlistWarningText: {
    fontSize: 10,
    color: '#FF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  providerText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
