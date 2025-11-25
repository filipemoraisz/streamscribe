import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

interface RecommendationBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export const RecommendationBanner: React.FC<RecommendationBannerProps> = ({
  visible,
  onDismiss,
}) => {
  if (!visible) return null;

  const handlePress = () => {
    onDismiss();
    router.push('/recommendations');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.banner} onPress={handlePress}>
        <View style={styles.iconContainer}>
          <Ionicons name="bulb" size={24} color={Colors.primary} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>New Recommendations Available!</Text>
          <Text style={styles.subtitle}>
            We've analyzed your watchlist and found great streaming deals for this month.
          </Text>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});