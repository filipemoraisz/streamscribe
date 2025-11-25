import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { ProviderRecommendation } from '../services/recommendations';

interface RecommendationCardProps {
  recommendation: ProviderRecommendation;
  rank: number;
  onPress?: () => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  rank,
  onPress,
}) => {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return Colors.textMuted;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return 'trophy';
      case 2: return 'medal';
      case 3: return 'medal-outline';
      default: return 'ribbon-outline';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.rankContainer}>
          <Ionicons 
            name={getRankIcon(rank)} 
            size={24} 
            color={getRankColor(rank)} 
          />
          <Text style={[styles.rankText, { color: getRankColor(rank) }]}>
            #{rank}
          </Text>
        </View>
        
        <View style={styles.providerInfo}>
          {recommendation.logoUrl ? (
            <Image 
              source={{ uri: recommendation.logoUrl }} 
              style={styles.providerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderLogo}>
              <Text style={styles.placeholderText}>
                {recommendation.providerName.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.providerName}>{recommendation.providerName}</Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Value Score</Text>
          <Text style={styles.scoreValue}>
            {Math.round(recommendation.score)}/100
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="list" size={16} color={Colors.primary} />
            <Text style={styles.statText}>
              {recommendation.totalItems} items
            </Text>
          </View>
          
          <View style={styles.stat}>
            <Ionicons name="film" size={16} color={Colors.primary} />
            <Text style={styles.statText}>
              {recommendation.availableContent.movies.length} movies
            </Text>
          </View>
          
          <View style={styles.stat}>
            <Ionicons name="tv" size={16} color={Colors.primary} />
            <Text style={styles.statText}>
              {recommendation.availableContent.tvShows.length} shows
            </Text>
          </View>
        </View>

        {recommendation.estimatedValue > 0 && (
          <View style={styles.valueContainer}>
            <Ionicons name="trending-up" size={16} color={Colors.success} />
            <Text style={styles.valueText}>
              Save ~${recommendation.estimatedValue.toFixed(0)} vs individual rentals
            </Text>
          </View>
        )}

        <View style={styles.reasoningContainer}>
          {recommendation.reasoning.slice(0, 2).map((reason, index) => (
            <View key={index} style={styles.reasonItem}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankContainer: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 40,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  providerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  content: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '20',
    padding: 8,
    borderRadius: 8,
  },
  valueText: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '500',
  },
  reasoningContainer: {
    gap: 4,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
});