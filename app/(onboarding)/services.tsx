import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { authService } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';

// Popular streaming services with TMDB provider IDs
const POPULAR_SERVICES = [
    { id: '8', name: 'Netflix', icon: 'https://image.tmdb.org/t/p/original/9A1JSVmSxsyaBK4SUFsYVqbAYfW.jpg' },
    { id: '9', name: 'Prime Video', icon: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
    { id: '337', name: 'Disney+', icon: 'https://image.tmdb.org/t/p/original/dgPueyEdOwpQ10fjuhL2WYFQwQs.jpg' },
    { id: '1899', name: 'HBO Max', icon: 'https://image.tmdb.org/t/p/original/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg' },
    { id: '15', name: 'Hulu', icon: 'https://image.tmdb.org/t/p/original/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg' },
    { id: '350', name: 'Apple TV+', icon: 'https://image.tmdb.org/t/p/original/2E03IAZsX4ZaUqM7tXlctEPMGWS.jpg' },
];

export default function ServicesScreen() {
    const { user, preferences, refreshPreferences } = useAuth();
    const router = useRouter();
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOnboarding, setIsOnboarding] = useState(true);

    // Load existing preferences when component mounts
    React.useEffect(() => {
        if (preferences) {
            setSelectedServices(preferences.subscribed_services || []);
            // If preferences exist and onboarding is completed, we're in settings mode
            setIsOnboarding(!preferences.onboarding_completed);
        }
    }, [preferences]);

    const toggleService = (serviceId: string) => {
        setSelectedServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const handleContinue = async () => {
        if (selectedServices.length === 0 && isOnboarding) {
            // Allow skipping during onboarding
            console.log('No services selected, but continuing anyway');
        }

        setLoading(true);
        try {
            // Save selected services to user preferences
            if (user) {
                console.log('[ServicesScreen] Saving subscriptions:', selectedServices);
                const result = await authService.saveUserPreferences({
                    subscribed_services: selectedServices,
                });
                console.log('[ServicesScreen] Save result:', result);
                // Refresh preferences in context
                await refreshPreferences();
                console.log('[ServicesScreen] Preferences refreshed');
            }
            
            // Navigate based on context
            if (isOnboarding) {
                // During onboarding, go to next step
                router.push('/(onboarding)/budget');
            } else {
                // From settings, go back
                router.back();
            }
        } catch (error) {
            console.error('Error saving services:', error);
            // Navigate anyway
            if (isOnboarding) {
                router.push('/(onboarding)/budget');
            } else {
                router.back();
            }
        } finally {
            setLoading(false);
        }
    };

    const renderServiceItem = ({ item }: { item: typeof POPULAR_SERVICES[0] }) => (
        <TouchableOpacity
            style={[
                styles.serviceCard,
                selectedServices.includes(item.id) && styles.serviceCardSelected
            ]}
            onPress={() => toggleService(item.id)}
        >
            <View style={styles.serviceContent}>
                <Image source={{ uri: item.icon }} style={styles.serviceIcon} />
                <Text style={styles.serviceName}>{item.name}</Text>
                {selectedServices.includes(item.id) && (
                    <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {isOnboarding ? 'Select Your Services' : 'Manage Subscriptions'}
            </Text>
            <Text style={styles.subtitle}>
                {isOnboarding 
                    ? 'Select the streaming services you use to get personalized recommendations.'
                    : 'Update your streaming subscriptions to get accurate recommendations.'}
            </Text>

            <FlatList
                data={POPULAR_SERVICES}
                renderItem={renderServiceItem}
                keyExtractor={item => item.id}
                numColumns={2}
                contentContainerStyle={styles.listContainer}
                columnWrapperStyle={styles.columnWrapper}
            />

            <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
                disabled={loading}
            >
                <Text style={styles.continueButtonText}>
                    {loading ? 'Saving...' : (isOnboarding ? 'Continue' : 'Save Changes')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: 48,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        marginBottom: 32,
        lineHeight: 24,
    },
    listContainer: {
        paddingBottom: 100,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    serviceCard: {
        width: '48%',
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    serviceCardSelected: {
        borderWidth: 2,
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    serviceContent: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
    },
    serviceIcon: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginBottom: 12,
        resizeMode: 'contain',
    },
    checkmark: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    serviceName: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    continueButton: {
        position: 'absolute',
        bottom: 48,
        left: 24,
        right: 24,
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
