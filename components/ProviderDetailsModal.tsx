import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { ProviderRecommendation } from '../services/recommendations';
import { WatchlistItem } from '../types';

interface ProviderDetailsModalProps {
  visible: boolean;
  recommendation: ProviderRecommendation | null;
  onClose: () => void;
  onItemPress?: (item: WatchlistItem) => void;
}

export const ProviderDetailsModal: React.FC<ProviderDetailsModalProps> = ({
  visible,
  recommendation,
  onClose,
  onItemPress,
}) => {
  if (!recommendation) return null;

  const renderContentItem = ({ item }: { item: WatchlistItem }) => (
    <TouchableOpacity 
      style={styles.contentItem}
      onPress={() => onItemPress?.(item)}
    >
      <View style={styles.contentInfo}>
        <Text style={styles.contentTitle}>{item.title}</Text>
        <View style={styles.contentMeta}>
          <Ionicons 
            name={item.type === 'movie' ? 'film' : 'tv'} 
            size={14} 
            color={Colors.textMuted} 
          />
          <Text style={styles.contentType}>
            {item.type === 'movie' ? 'Movie' : 'TV Show'}
          </Text>
          {(item.release_date || item.first_air_date) && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.contentYear}>
                {new Date(item.release_date || item.first_air_date!).getFullYear()}
              </Text>
            </>
          )}
          <Text style={styles.separator}>•</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={12} color={Colors.primary} />
            <Text style={styles.rating}>{item.vote_average.toFixed(1)}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  const allContent = [
    ...recommendation.availableContent.movies,
    ...recommendation.availableContent.tvShows,
  ].sort((a, b) => b.vote_average - a.vote_average);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          
          <View style={styles.providerHeader}>
            {recommendation.logoUrl ? (
              <Image 
                source={{ uri: recommendation.logoUrl }} 
                style={styles.providerLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderLogo}>
                <Text style={styles.placeholderText}>
                  {recommendation.providerName.charAt(0)}
                </Text>
              </View>
            )}
            <Text style={styles.providerName}>{recommendation.providerName}</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recommendation.totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recommendation.availableContent.movies.length}</Text>
            <Text style={styles.statLabel}>Movies</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recommendation.availableContent.tvShows.length}</Text>
            <Text style={styles.statLabel}>TV Shows</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${recommendation.estimatedValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Est. Savings</Text>
          </View>
        </View>

        <View style={styles.reasoningSection}>
          <Text style={styles.sectionTitle}>Why We Recommend This Service</Text>
          {recommendation.reasoning.map((reason, index) => (
            <View key={index} style={styles.reasonItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Available Content from Your Watchlist</Text>
          <FlatList
            data={allContent}
            renderItem={renderContentItem}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            style={styles.contentList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 8,
    marginRight: 16,
  },
  providerHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  reasoningSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentList: {
    flex: 1,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contentInfo: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  contentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contentType: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  separator: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  contentYear: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});