import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomTabHeader } from '../../components/CustomTabHeader';
import { SubscriptionTimeline } from '../../components/SubscriptionTimeline';
import { Colors } from '../../constants/Colors';
import { OptimizationPlan, optimizerService } from '../../services/optimizer';
import { storageService } from '../../services/storage';

const HEADER_HEIGHT = 70; // Matches profile screen (no filters)

export default function OptimizerScreen() {
    const insets = useSafeAreaInsets();
    const [plan, setPlan] = useState<OptimizationPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
        return {
            opacity,
        };
    });

    const loadPlan = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        
        try {
            const watchlist = await storageService.getWatchlist();
            const newPlan = await optimizerService.generateOptimizationPlan(watchlist);
            setPlan(newPlan);
        } catch (error) {
            console.error('Error generating plan:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        loadPlan(true);
    };

    useEffect(() => {
        loadPlan();
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Optimizing your subscriptions...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: HEADER_HEIGHT + insets.top + 20 }
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        progressViewOffset={HEADER_HEIGHT + insets.top}
                    />
                }
            >
                {plan ? (
                    <SubscriptionTimeline plan={plan} onRecalculate={() => loadPlan(false)} />
                ) : (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>Could not generate plan.</Text>
                    </View>
                )}
            </Animated.ScrollView>

            {/* Sticky Header */}
            <CustomTabHeader
                title="Your Calendar"
                headerAnimatedStyle={headerAnimatedStyle}
                height={HEADER_HEIGHT + insets.top}
                paddingTop={insets.top + 10}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: Colors.textSecondary,
        marginTop: 16,
    },
    errorContainer: {
        padding: 20,
        alignItems: 'center',
    },
    errorText: {
        color: Colors.error,
        fontSize: 16,
    },
});
