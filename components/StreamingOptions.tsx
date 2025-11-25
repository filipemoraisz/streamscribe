import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { StreamingOption } from '../types';

interface StreamingOptionsProps {
  options: StreamingOption[];
}

export const StreamingOptions: React.FC<StreamingOptionsProps> = ({ options }) => {
  const handlePress = (link: string) => {
    Linking.openURL(link);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'flatrate':
        return Colors.success;
      case 'free':
        return Colors.primary;
      case 'buy':
        return Colors.warning;
      case 'rent':
        return Colors.secondary;
      default:
        return Colors.textMuted;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'flatrate':
        return 'Subscription';
      case 'free':
        return 'Free';
      case 'buy':
        return 'Buy';
      case 'rent':
        return 'Rent';
      default:
        return type;
    }
  };

  const getProviderIcon = (option: StreamingOption) => {
    // Use the logo from the service imageSet (provided by TMDB)
    if (option.service.imageSet?.darkThemeImage) {
      return option.service.imageSet.darkThemeImage;
    }
    
    // Fallback to placeholder with provider name initial
    return `https://via.placeholder.com/92x92/666666/FFFFFF?text=${encodeURIComponent(option.service.name.charAt(0))}`;
  };

  if (options.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Where to Watch</Text>
        <Text style={styles.noOptions}>No streaming options available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where to Watch</Text>
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            onPress={() => handlePress(option.link)}
          >
            <View style={styles.serviceInfo}>
              <Image
                source={{ uri: getProviderIcon(option) }}
                style={styles.serviceIcon}
                resizeMode="contain"
              />
              <View style={styles.serviceDetails}>
                <Text style={styles.serviceName}>{option.service.name}</Text>
                <View style={styles.typeContainer}>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeColor(option.type) }]}>
                    <Text style={styles.typeText}>{getTypeLabel(option.type)}</Text>
                  </View>
                  {option.price && (
                    <Text style={styles.price}>{option.price.formatted}</Text>
                  )}
                </View>
              </View>
            </View>
            {option.quality && (
              <Text style={styles.quality}>{option.quality}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      {/* JustWatch Attribution */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>
          Streaming data powered by{' '}
          <Text 
            style={styles.attributionLink}
            onPress={() => Linking.openURL('https://www.justwatch.com')}
          >
            JustWatch
          </Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  noOptions: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  price: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quality: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  attribution: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
    alignItems: 'center',
  },
  attributionText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  attributionLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});