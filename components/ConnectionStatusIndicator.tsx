import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, AnimationTiming } from '../constants/BrandTokens';

export interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  isConnecting: boolean;
  onPress?: () => void;
  showLabel?: boolean;
}

/**
 * ConnectionStatusIndicator Component
 * 
 * Shows the real-time connection status in the app header or status bar.
 * Provides visual feedback for connection state changes.
 */
export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  isConnected,
  isConnecting,
  onPress,
  showLabel = false,
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));
  const [showReconnected, setShowReconnected] = useState(false);

  // Pulse animation for connecting state
  useEffect(() => {
    if (isConnecting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: AnimationTiming.normal,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: AnimationTiming.normal,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnecting, pulseAnim]);

  // Show reconnected message briefly
  useEffect(() => {
    if (isConnected && !isConnecting) {
      setShowReconnected(true);
      
      // Slide in animation
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: AnimationTiming.normal,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: AnimationTiming.normal,
          useNativeDriver: true,
        }).start(() => {
          setShowReconnected(false);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, isConnecting, slideAnim]);

  const getStatusColor = () => {
    if (isConnecting) return BrandTokens.warning;
    return isConnected ? BrandTokens.success : BrandTokens.error;
  };

  const getStatusIcon = () => {
    if (isConnecting) return 'sync-outline';
    return isConnected ? 'wifi' : 'cloud-offline-outline';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    return isConnected ? 'Online' : 'Offline';
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();
  const statusText = getStatusText();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.indicator}
        onPress={onPress}
        disabled={!onPress}
      >
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: pulseAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Ionicons name={statusIcon} size={16} color={statusColor} />
        </Animated.View>
        
        {showLabel && (
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusText}
          </Text>
        )}
      </TouchableOpacity>

      {/* Reconnected message */}
      {showReconnected && (
        <Animated.View
          style={[
            styles.reconnectedBanner,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={BrandTokens.success} />
          <Text style={styles.reconnectedText}>Back online</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  statusText: {
    ...Typography.bodySmall,
    fontSize: 12,
    fontWeight: '600',
  },
  reconnectedBanner: {
    position: 'absolute',
    top: 30,
    right: 0,
    backgroundColor: BrandTokens.success,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reconnectedText: {
    ...Typography.bodySmall,
    fontSize: 12,
    color: BrandTokens.white,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
});