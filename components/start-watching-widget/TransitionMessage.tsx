import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TransitionMessageProps {
  onDismiss: () => void;
}

export const TransitionMessage: React.FC<TransitionMessageProps> = ({
  onDismiss,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after 2 seconds
    const dismissTimer = setTimeout(() => {
      // Fade out before dismissing
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onDismiss();
      });
    }, 2000);

    return () => {
      clearTimeout(dismissTimer);
    };
  }, [fadeAnim, onDismiss]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Ionicons name="sparkles" size={24} color="#9C27B0" style={styles.icon} />
        <Text style={styles.text}>
          More Recommendations Based on Your Taste Profile
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A148C',
    textAlign: 'center',
    flex: 1,
  },
});
