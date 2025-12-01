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
const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

export const SurpriseButton: React.FC<SurpriseButtonProps> = ({
  onPress,
  loading = false,
}) => {
  const scale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const iconScale = useSharedValue(1);

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

  // Animated styles for the icon
  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${iconRotation.value}deg` },
        { scale: iconScale.value },
      ],
    };
  });

  // Icon animation - continuous rotation and pulse when not loading
  React.useEffect(() => {
    if (!loading) {
      // Continuous rotation
      iconRotation.value = withRepeat(
        withTiming(360, { duration: 3000 }),
        -1, // Infinite
        false
      );

      // Gentle pulse
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1, // Infinite
        false
      );
    } else {
      iconRotation.value = withTiming(0, { duration: 200 });
      iconScale.value = withTiming(1, { duration: 200 });
    }
  }, [loading]);

  return (
    <AnimatedTouchableOpacity
      style={[styles.button, animatedButtonStyle]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.text} style={styles.icon} />
      ) : (
        <AnimatedIcon
          name="shuffle"
          size={24}
          color={Colors.text}
          style={[styles.icon, animatedIconStyle]}
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.elevated,
    // Bold light effect
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
