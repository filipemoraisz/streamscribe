import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConnectionBannerProps {
  isConnected: boolean;
  isConnecting: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isConnected,
  isConnecting,
}) => {
  const insets = useSafeAreaInsets();
  const [showSynced, setShowSynced] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [previousConnected, setPreviousConnected] = useState(isConnected);

  useEffect(() => {
    // Detect when we go from disconnected/connecting to connected
    if (!previousConnected && isConnected && !isConnecting) {
      // Show "Synced" message
      setShowSynced(true);
      
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSynced(false);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }

    setPreviousConnected(isConnected);
  }, [isConnected, isConnecting, previousConnected, fadeAnim]);

  // Don't show anything if connected and not showing synced message
  if (isConnected && !showSynced) {
    return null;
  }

  const getMessage = () => {
    if (showSynced) return 'Synced.';
    if (isConnecting) return 'Reconnecting...';
    return "You're offline. Changes will sync when online.";
  };

  const getBackgroundColor = () => {
    if (showSynced) return '#000000'; // Black for synced
    if (isConnecting) return '#000000'; // Black for reconnecting
    return '#000000'; // Black for offline
  };

  const getTextColor = () => {
    if (showSynced) return '#4CAF50'; // Green for synced
    return '#FFFFFF'; // White for offline/reconnecting
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: insets.top,
          backgroundColor: getBackgroundColor(),
          opacity: showSynced ? fadeAnim : 1,
        },
      ]}
    >
      <Text style={[styles.bannerText, { color: getTextColor() }]}>
        {getMessage()}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
