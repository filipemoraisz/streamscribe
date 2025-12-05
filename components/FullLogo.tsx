import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface FullLogoProps {
  width?: number;
  height?: number;
  style?: ImageStyle;
}

export const FullLogo: React.FC<FullLogoProps> = ({ width = 200, height = 100, style }) => {
  // Note: To use SVG directly in React Native, you need to either:
  // 1. Use react-native-svg-transformer (requires metro config)
  // 2. Convert SVG to React Native components
  // 3. Use Image component with PNG
  
  // For now using PNG, but you can replace with SVG transformer setup
  return (
    <Image
      source={require('../assets/images/streamscribe_round.png')}
      style={[{ width, height, resizeMode: 'contain' }, style]}
    />
  );
};
