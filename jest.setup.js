import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

// Mock Animated API
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = () => ({
    start: jest.fn(),
    stop: jest.fn(),
  });
  RN.Animated.loop = (animation) => animation;
  RN.Animated.sequence = (animations) => ({
    start: jest.fn(),
    stop: jest.fn(),
  });
  return RN;
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: Text,
  };
});