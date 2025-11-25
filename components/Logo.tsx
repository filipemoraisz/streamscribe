import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface LogoProps {
  width?: number;
  height?: number;
  style?: ImageStyle;
}

export const Logo: React.FC<LogoProps> = ({ width = 120, height = 40, style }) => {
  return (
    <Image
      source={require('../assets/images/logo-text-white.png')}
      style={[{ width, height, resizeMode: 'contain' }, style]}
    />
  );
};