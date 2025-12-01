import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type EmptyStateType = 'no_subscriptions' | 'no_matching_content' | 'all_caught_up';

interface EmptyStateProps {
  type: EmptyStateType;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
  const router = useRouter();

  const handleSetupSubscriptions = () => {
    router.push('/settings');
  };

  // Render based on empty state type
  switch (type) {
    case 'no_subscriptions':
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="tv-outline" size={64} color="#666" />
          </View>
          <Text style={styles.title}>Set Up Subscriptions</Text>
          <Text style={styles.description}>
            Add your streaming services to get personalized recommendations
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleSetupSubscriptions}>
            <Text style={styles.buttonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      );

    case 'no_matching_content':
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="search-outline" size={64} color="#666" />
          </View>
          <Text style={styles.title}>No Unwatched Items Available</Text>
          <Text style={styles.description}>
            Add more shows and movies to your watchlist to see recommendations here
          </Text>
        </View>
      );

    case 'all_caught_up':
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#4CAF50" />
          </View>
          <Text style={styles.title}>All Caught Up!</Text>
          <Text style={styles.description}>
            Check back later for new recommendations
          </Text>
        </View>
      );

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  container: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
