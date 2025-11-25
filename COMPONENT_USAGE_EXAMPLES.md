# Component Usage Examples

This document shows how to properly import and use the new recommendation feature components.

## Import Methods

### Individual Imports (Current)
```typescript
import { RecommendationCard } from '../../components/RecommendationCard';
import { ProviderDetailsModal } from '../../components/ProviderDetailsModal';
import { RecommendationBanner } from '../../components/RecommendationBanner';
```

### Grouped Imports (Recommended)
```typescript
import { 
  RecommendationCard, 
  ProviderDetailsModal, 
  RecommendationBanner 
} from '../../components';
```

### Service Imports
```typescript
import { 
  recommendationService, 
  ProviderRecommendation, 
  MonthlyRecommendation 
} from '../../services';
```

## Component Usage Examples

### 1. RecommendationCard

```typescript
import React from 'react';
import { RecommendationCard } from '../../components/RecommendationCard';
import { ProviderRecommendation } from '../../services/recommendations';

interface MyComponentProps {
  recommendation: ProviderRecommendation;
}

const MyComponent: React.FC<MyComponentProps> = ({ recommendation }) => {
  const handleProviderPress = () => {
    console.log('Provider pressed:', recommendation.providerId);
  };

  return (
    <RecommendationCard
      recommendation={recommendation}
      rank={1}
      onPress={handleProviderPress}
    />
  );
};
```

### 2. ProviderDetailsModal

```typescript
import React, { useState } from 'react';
import { ProviderDetailsModal } from '../../components/ProviderDetailsModal';
import { ProviderRecommendation } from '../../services/recommendations';
import { WatchlistItem } from '../../types';

const MyComponent: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderRecommendation | null>(null);

  const handleItemPress = (item: WatchlistItem) => {
    // Navigate to item details
    console.log('Item pressed:', item.title);
  };

  return (
    <ProviderDetailsModal
      visible={modalVisible}
      recommendation={selectedProvider}
      onClose={() => setModalVisible(false)}
      onItemPress={handleItemPress}
    />
  );
};
```

### 3. RecommendationBanner

```typescript
import React, { useState } from 'react';
import { RecommendationBanner } from '../../components/RecommendationBanner';

const MyComponent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <RecommendationBanner
      visible={showBanner}
      onDismiss={() => setShowBanner(false)}
    />
  );
};
```

## Complete Integration Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { 
  RecommendationCard, 
  ProviderDetailsModal, 
  RecommendationBanner 
} from '../../components';
import { 
  recommendationService, 
  MonthlyRecommendation, 
  ProviderRecommendation 
} from '../../services';

const RecommendationsScreen: React.FC = () => {
  const [recommendations, setRecommendations] = useState<MonthlyRecommendation | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderRecommendation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const monthlyRecs = await recommendationService.generateMonthlyRecommendations();
      setRecommendations(monthlyRecs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const handleProviderPress = (providerId: string) => {
    const provider = recommendations?.topProviders.find(p => p.providerId === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setModalVisible(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <RecommendationBanner
        visible={showBanner}
        onDismiss={() => setShowBanner(false)}
      />
      
      <ScrollView>
        {recommendations?.topProviders.map((recommendation, index) => (
          <RecommendationCard
            key={recommendation.providerId}
            recommendation={recommendation}
            rank={index + 1}
            onPress={() => handleProviderPress(recommendation.providerId)}
          />
        ))}
      </ScrollView>

      <ProviderDetailsModal
        visible={modalVisible}
        recommendation={selectedProvider}
        onClose={() => setModalVisible(false)}
        onItemPress={(item) => {
          // Navigate to item details
          console.log('Navigate to:', item.title);
        }}
      />
    </View>
  );
};

export default RecommendationsScreen;
```

## Required Props

### RecommendationCard Props
- `recommendation: ProviderRecommendation` - The provider recommendation data
- `rank: number` - The ranking position (1, 2, 3, etc.)
- `onPress?: () => void` - Optional callback when card is pressed

### ProviderDetailsModal Props
- `visible: boolean` - Whether the modal is visible
- `recommendation: ProviderRecommendation | null` - The provider data to display
- `onClose: () => void` - Callback when modal should be closed
- `onItemPress?: (item: WatchlistItem) => void` - Optional callback when content item is pressed

### RecommendationBanner Props
- `visible: boolean` - Whether the banner is visible
- `onDismiss: () => void` - Callback when banner is dismissed

## Type Definitions

```typescript
interface ProviderRecommendation {
  providerId: string;
  providerName: string;
  logoUrl?: string;
  score: number;
  availableContent: {
    movies: WatchlistItem[];
    tvShows: WatchlistItem[];
  };
  totalItems: number;
  estimatedValue: number;
  reasoning: string[];
}

interface MonthlyRecommendation {
  month: string;
  year: number;
  topProviders: ProviderRecommendation[];
  totalWatchlistItems: number;
  coveragePercentage: number;
  estimatedMonthlySavings: number;
}
```

## Best Practices

1. **Error Handling**: Always wrap recommendation service calls in try-catch blocks
2. **Loading States**: Show loading indicators while fetching recommendations
3. **Empty States**: Handle cases where no recommendations are available
4. **Performance**: Use React.memo for recommendation cards if rendering many items
5. **Accessibility**: Ensure all interactive elements have proper accessibility labels

## Common Patterns

### Loading Recommendations
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const loadRecommendations = async () => {
  try {
    setLoading(true);
    setError(null);
    const recommendations = await recommendationService.generateMonthlyRecommendations();
    setRecommendations(recommendations);
  } catch (err) {
    setError('Failed to load recommendations');
  } finally {
    setLoading(false);
  }
};
```

### Conditional Rendering
```typescript
{recommendations?.topProviders.length > 0 ? (
  recommendations.topProviders.map((rec, index) => (
    <RecommendationCard key={rec.providerId} recommendation={rec} rank={index + 1} />
  ))
) : (
  <Text>No recommendations available</Text>
)}
```