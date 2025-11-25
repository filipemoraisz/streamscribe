/**
 * Font Configuration
 * 
 * Defines font loading and family mappings for the AR Store Gamification app.
 * Includes Press Start 2P for branding, Poppins for headings, and Inter for UI.
 */

import { useFonts } from 'expo-font';

export const FontFamilies = {
  // Brand/Logo font
  PressStart2P: 'PressStart2P-Regular',
  
  // Heading fonts (Poppins)
  PoppinsBold: 'Poppins-Bold',
  PoppinsSemiBold: 'Poppins-SemiBold',
  PoppinsRegular: 'Poppins-Regular',
  
  // UI fonts (Inter)
  InterBold: 'Inter-Bold',
  InterSemiBold: 'Inter-SemiBold',
  InterRegular: 'Inter-Regular',
} as const;

/**
 * Custom hook to load all required fonts for the app
 */
export const useAppFonts = () => {
  const [fontsLoaded] = useFonts({
    // Press Start 2P for pixel-style branding
    'PressStart2P-Regular': require('../assets/fonts/PressStart2P-Regular.ttf'),
    
    // Poppins font family for headings
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    
    // Inter font family for UI elements
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  });

  return fontsLoaded;
};

/**
 * Font loading configuration for app.json
 */
export const fontAssets = [
  require('../assets/fonts/PressStart2P-Regular.ttf'),
  require('../assets/fonts/Poppins-Bold.ttf'),
  require('../assets/fonts/Poppins-SemiBold.ttf'),
  require('../assets/fonts/Poppins-Regular.ttf'),
  require('../assets/fonts/Inter-Bold.ttf'),
  require('../assets/fonts/Inter-SemiBold.ttf'),
  require('../assets/fonts/Inter-Regular.ttf'),
];