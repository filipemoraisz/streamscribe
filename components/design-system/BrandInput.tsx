import React, { useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from 'react-native';
import { AnimationTiming, BorderRadius, BrandTokens, Spacing, Typography } from '../../constants/BrandTokens';

export interface BrandInputProps extends Omit<TextInputProps, 'style'> {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  error?: string;
  label?: string;
  style?: ViewStyle;
}

/**
 * BrandInput Component
 * 
 * Styled input field following the brand design system.
 * Features focus animations, error states, and accessibility support.
 * Height: 48px, background: inputGray, focus state: pink outline
 */
export const BrandInput: React.FC<BrandInputProps> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  label,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: AnimationTiming.normal,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: AnimationTiming.normal,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', BrandTokens.ctaPink],
  });

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const containerStyle = [
    styles.container,
    style,
  ];

  const inputContainerStyle = [
    styles.inputContainer,
    error && styles.inputContainerError,
    {
      transform: [{ translateY }],
    },
  ];

  const animatedBorderStyle = {
    borderColor,
    borderWidth: isFocused ? 2 : 0,
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <Animated.View style={[inputContainerStyle, animatedBorderStyle]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={BrandTokens.mutedGray}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          accessible={true}
          accessibilityLabel={label || placeholder}
          accessibilityHint={error ? `Error: ${error}` : undefined}
          {...props}
        />
      </Animated.View>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.inputLabel,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    height: 48,
    backgroundColor: BrandTokens.inputGray,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  inputContainerError: {
    borderColor: BrandTokens.error,
    borderWidth: 1,
  },
  input: {
    ...Typography.body,
    color: BrandTokens.bgDarkGray,
    flex: 1,
  },
  errorText: {
    ...Typography.bodySmall,
    color: BrandTokens.error,
    marginTop: Spacing.xs,
  },
});