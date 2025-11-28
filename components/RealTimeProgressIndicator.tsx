import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, AnimationTiming } from '../constants/BrandTokens';
import { useProgressRealTimeUpdates } from './hooks/useRealTimeUpdates';
import { RealTimeUpdate } from '../types';

export interface RealTimeProgressIndicatorProps {
  showId: number;
  currentProgress?: {
    season: number;
    episode: number;
    watched: boolean;
  };
  compact?: boolean;
}

/**
 * RealTimeProgressIndicator Component
 * 
 * Shows real-time progress updates for a specific show.
 * Displays sync status and immediate feedback for progress changes.
 */
export const RealTimeProgressIndicator: React.FC<RealTimeProgressIndicatorProps> = ({
  showId,
  currentProgress,
  compact = false,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [syncAnimation] = useState(new Animated.Value(0));

  // Handle real-time progress updates for this show
  useProgressRealTimeUpdates((update: RealTimeUpdate) => {
    if (update.type === 'progress' && update.data?.progress?.show_id === showId) {
      handleProgressUpdate(update);
    }
  });

  const handleProgressUpdate = (update: RealTimeUpdate) => {
    setIsSyncing(true);
    setLastUpdate(new Date().toISOString());

    // Start sync animation
    Animated.sequence([
      Animated.timing(syncAnimation, {
        toValue: 1,
        duration: AnimationTiming.fast,
        useNativeDriver: true,
      }),
      Animated.timing(syncAnimation, {
        toValue: 0,
        duration: AnimationTiming.normal,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSyncing(false);
    });
  };

  const formatLastUpdate = (timestamp: string) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 5) return 'Just synced';
    if (diffSecs < 60) return `Synced ${diffSecs}s ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `Synced ${diffMins}m ago`;
    
    return 'Synced';
  };

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          {
            opacity: syncAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            }),
            transform: [
              {
                scale: syncAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      >
        {isSyncing ? (
          <Ionicons name="sync" size={12} color={BrandTokens.brandLime} />
        ) : (
          <View style={[styles.syncDot, { backgroundColor: BrandTokens.success }]} />
        )}
      </Animated.View>
    );
  }

  if (!lastUpdate && !isSyncing) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: syncAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          }),
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={isSyncing ? "sync" : "checkmark-circle"}
          size={14}
          color={isSyncing ? BrandTokens.brandLime : BrandTokens.success}
        />
        <Text style={styles.statusText}>
          {isSyncing ? 'Syncing...' : formatLastUpdate(lastUpdate)}
        </Text>
      </View>
      
      {currentProgress && (
        <Text style={styles.progressText}>
          S{currentProgress.season}E{currentProgress.episode}
          {currentProgress.watched && ' ✓'}
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: BorderRadius.xs,
    padding: Spacing.xs,
    marginTop: Spacing.xs,
  },
  compactContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.bodySmall,
    fontSize: 11,
    color: BrandTokens.white,
    fontWeight: '500',
  },
  progressText: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: BrandTokens.mutedGray,
    marginTop: 2,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});