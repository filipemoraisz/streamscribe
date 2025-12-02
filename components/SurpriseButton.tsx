import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { BrandTokens, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';

interface SurpriseButtonProps {
  onPress: () => void;
  loading?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const SurpriseButton: React.FC<SurpriseButtonProps> = ({
  onPress,
  loading = false,
}) => {
  const scale = useSharedValue(1);

  const handlePress = async () => {
    // Trigger haptic feedback
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }

    // Trigger press animation
    scale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );

    // Call the onPress handler
    onPress();
  };

  // Animated styles for the button
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });



  // No continuous animation - icon stays static

  return (
    <AnimatedTouchableOpacity
      style={[styles.button, animatedButtonStyle]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FF6B35" style={styles.icon} />
      ) : (
        <Ionicons
          name="shuffle"
          size={24}
          color="#FF6B35"
          style={styles.icon}
        />
      )}
      <Text style={styles.buttonText}>
        {loading ? 'Finding...' : 'Surprise Me'}
      </Text>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    // Glowing orange edges
    borderWidth: 2,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
