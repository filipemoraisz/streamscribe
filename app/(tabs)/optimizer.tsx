import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SubscriptionTimeline } from '../../components/SubscriptionTimeline';
import { Colors } from '../../constants/Colors';
import { OptimizationPlan, optimizerService } from '../../services/optimizer';
import { storageService } from '../../services/storage';

export default function OptimizerScreen() {
    const [plan, setPlan] = useState<OptimizationPlan | null>(null);
    const [loading, setLoading] = useState(true);

    const loadPlan = async () => {
        setLoading(true);
        try {
            const watchlist = await storageService.getWatchlist();
            const newPlan = await optimizerService.generateOptimizationPlan(watchlist);
            setPlan(newPlan);
        } catch (error) {
            console.error('Error generating plan:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlan();
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Calendar',
                    headerLargeTitle: true,
                }}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Optimizing your subscriptions...</Text>
                </View>
            ) : plan ? (
                <View style={{ flex: 1, paddingTop: 140 }}>
                    <SubscriptionTimeline plan={plan} onRecalculate={loadPlan} />
                </View>
            ) : (
                <View style={styles.center}>
                    <Text style={styles.errorText}>Could not generate plan.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
    errorText: {
        color: Colors.error,
    },
});
