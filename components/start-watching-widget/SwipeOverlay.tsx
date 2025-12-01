import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface SwipeOverlayProps {
  direction: 'left' | 'right' | 'up' | null;
  opacity: number;
}

// Overlay configuration for each swipe direction
const OVERLAY_CONFIG = {
  right: {
    color: '#4CAF50',
    icon: 'checkmark-circle' as const,
    text: 'WATCHED',
    gradient: ['rgba(76, 175, 80, 0)', 'rgba(76, 175, 80, 0.9)'],
  },
  left: {
    color: '#FF6B35',
    icon: 'time-outline' as const,
    text: 'LATER',
    gradient: ['rgba(255, 107, 53, 0)', 'rgba(255, 107, 53, 0.9)'],
  },
  up: {
    color: '#F44336',
    icon: 'trash-outline' as const,
    text: 'REMOVE',
    gradient: ['rgba(244, 67, 54, 0)', 'rgba(244, 67, 54, 0.9)'],
  },
};

export const SwipeOverlay: React.FC<SwipeOverlayProps> = ({
  direction,
  opacity,
}) => {
  if (!direction) return null;

  const config = OVERLAY_CONFIG[direction];

  return (
    <View style={[styles.container, { opacity }]}>
      <LinearGradient
        colors={config.gradient}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <Ionicons name={config.icon} size={64} color="#FFFFFF" />
          <Text style={styles.text}>{config.text}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
