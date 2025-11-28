import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius } from '../constants/BrandTokens';

export interface SyncStatusIndicatorProps {
  isConnected: boolean;
  isProcessing: boolean;
  pendingActions: number;
  lastSyncTime?: string;
  onPress?: () => void;
  compact?: boolean;
}

/**
 * SyncStatusIndicator Component
 * 
 * Shows the current real-time sync status with visual indicators
 * for connection state, pending actions, and last sync time.
 */
export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  isConnected,
  isProcessing,
  pendingActions,
  lastSyncTime,
  onPress,
  compact = false,
}) => {
  const getStatusColor = () => {
    if (!isConnected) return BrandTokens.error;
    if (isProcessing || pendingActions > 0) return BrandTokens.warning;
    return BrandTokens.success;
  };

  const getStatusIcon = () => {
    if (!isConnected) return 'cloud-offline-outline';
    if (isProcessing) return 'sync-outline';
    if (pendingActions > 0) return 'cloud-upload-outline';
    return 'cloud-done-outline';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Offline';
    if (isProcessing) return 'Syncing...';
    if (pendingActions > 0) return `${pendingActions} pending`;
    return 'Synced';
  };

  const formatLastSyncTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(timestamp);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();
  const statusText = getStatusText();

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { borderColor: statusColor }]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        {isProcessing && (
          <ActivityIndicator
            size="small"
            color={statusColor}
            style={styles.compactSpinner}
          />
        )}
        {pendingActions > 0 && !isProcessing && (
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{pendingActions}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={statusColor} />
          ) : (
            <Ionicons name={statusIcon} size={16} color={statusColor} />
          )}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusText}
          </Text>
          {lastSyncTime && !compact && (
            <Text style={styles.lastSyncText}>
              Last sync: {formatLastSyncTime(lastSyncTime)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BrandTokens.bgDarkGray,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
  },
  compactContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  lastSyncText: {
    ...Typography.bodySmall,
    fontSize: 12,
    color: BrandTokens.mutedGray,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactSpinner: {
    position: 'absolute',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: BrandTokens.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});