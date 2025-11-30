import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants/Colors';
import { AchievementStats, TIER_COLORS } from '../types';

interface AchievementStatsCardProps {
  stats: AchievementStats;
}

export const AchievementStatsCard: React.FC<AchievementStatsCardProps> = ({ stats }) => {
  const { total_unlocked, total_available, completion_percentage, total_points, by_tier } = stats;

  // Circular progress indicator component
  const CircularProgress = ({ percentage }: { percentage: number }) => {
    const radius = 50;
    const strokeWidth = 8;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <View style={styles.circularProgressContainer}>
        <Svg width={radius * 2} height={radius * 2}>
          {/* Background circle */}
          <Circle
            stroke={Colors.surface}
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <Circle
            stroke={Colors.primary}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            rotation="-90"
            origin={`${radius}, ${radius}`}
          />
        </Svg>
        <View style={styles.circularProgressText}>
          <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
          <Text style={styles.percentageLabel}>Complete</Text>
        </View>
      </View>
    );
  };

  // Tier row component
  const TierRow = ({ 
    tier, 
    unlocked, 
    total 
  }: { 
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'; 
    unlocked: number; 
    total: number;
  }) => {
    const tierColors = TIER_COLORS[tier];
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    const tierPercentage = total > 0 ? (unlocked / total) * 100 : 0;

    return (
      <View style={styles.tierRow}>
        <View style={styles.tierLabelContainer}>
          <View style={[styles.tierDot, { backgroundColor: tierColors.primary }]} />
          <Text style={styles.tierLabel}>{tierName}</Text>
        </View>
        <View style={styles.tierProgressContainer}>
          <View style={styles.tierProgressBar}>
            <View 
              style={[
                styles.tierProgressFill,
                { 
                  width: `${tierPercentage}%`,
                  backgroundColor: tierColors.primary
                }
              ]}
            />
          </View>
          <Text style={styles.tierCount}>
            {unlocked}/{total}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="trophy" size={24} color={Colors.primary} />
        <Text style={styles.headerTitle}>Achievement Progress</Text>
      </View>

      {/* Main Stats Row */}
      <View style={styles.mainStatsRow}>
        {/* Circular Progress */}
        <CircularProgress percentage={completion_percentage} />

        {/* Stats Summary */}
        <View style={styles.statsSummary}>
          {/* Total Unlocked */}
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{total_unlocked}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>

          {/* Total Available */}
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{total_available}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>

          {/* Total Points */}
          <View style={styles.statItem}>
            <View style={styles.pointsRow}>
              <Ionicons name="star" size={16} color={Colors.primary} />
              <Text style={[styles.statValue, styles.pointsValue]}>{total_points}</Text>
            </View>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Tier Breakdown */}
      <View style={styles.tierBreakdown}>
        <Text style={styles.tierBreakdownTitle}>By Tier</Text>
        <TierRow tier="bronze" unlocked={by_tier.bronze.unlocked} total={by_tier.bronze.total} />
        <TierRow tier="silver" unlocked={by_tier.silver.unlocked} total={by_tier.silver.total} />
        <TierRow tier="gold" unlocked={by_tier.gold.unlocked} total={by_tier.gold.total} />
        <TierRow tier="platinum" unlocked={by_tier.platinum.unlocked} total={by_tier.platinum.total} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  mainStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  circularProgressContainer: {
    position: 'relative',
    marginRight: 24,
  },
  circularProgressText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  percentageLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsSummary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsValue: {
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  tierBreakdown: {
    gap: 12,
  },
  tierBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tierLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  tierProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  tierProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 12,
  },
  tierProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tierCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
});
