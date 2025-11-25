import React from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import { AnimationTiming, BorderRadius, BrandTokens, Shadows, Typography } from '../../constants/BrandTokens';

export interface PrimaryCTAProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * PrimaryCTA Component
 * 
 * Primary call-to-action button following the brand design system.
 * Full-width, height: 52px, pink background with shadow, uppercase text.
 * Includes press animations and loading states.
 */
export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleValue, {
      toValue: 0.95,
      duration: AnimationTiming.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: AnimationTiming.fast,
      useNativeDriver: true,
    }).start();
  };

  const isDisabled = disabled || loading;

  const buttonStyle = [
    styles.button,
    isDisabled && styles.buttonDisabled,
    style,
  ];

  const textStyle = [
    styles.text,
    isDisabled && styles.textDisabled,
  ];

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessible={true}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
      >
        {loading ? (
          <ActivityIndicator color={BrandTokens.white} size="small" />
        ) : (
          <Text style={textStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    backgroundColor: BrandTokens.ctaPink,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  buttonDisabled: {
    backgroundColor: BrandTokens.mutedGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    ...Typography.button,
    color: BrandTokens.white,
  },
  textDisabled: {
    color: BrandTokens.white,
    opacity: 0.7,
  },
});