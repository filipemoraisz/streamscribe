import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { authService } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';

// Mock list of popular services
const POPULAR_SERVICES = [
    { id: 'netflix', name: 'Netflix', icon: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjDaoVHO4NsZ0I.jpg' },
    { id: 'amazon', name: 'Prime Video', icon: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
    { id: 'disney', name: 'Disney+', icon: 'https://image.tmdb.org/t/p/original/7qe34O5qW89K8OSUP0D5j96vxl5.jpg' },
    { id: 'hbo', name: 'HBO Max', icon: 'https://image.tmdb.org/t/p/original/zIxhJps7652579g5azVwnJ8749z.jpg' },
    { id: 'hulu', name: 'Hulu', icon: 'https://image.tmdb.org/t/p/original/z83o395-7Fv4-4b1-8-9d-1.jpg' }, // Placeholder, need actual Hulu logo URL if possible, or use local asset
    { id: 'apple', name: 'Apple TV+', icon: 'https://image.tmdb.org/t/p/original/4KAy34EHvRM25Ih8wb82AuGU7zJ.jpg' },
];

export default function ServicesScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleService = (serviceId: string) => {
        setSelectedServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const handleContinue = async () => {
        if (selectedServices.length === 0) {
            // Allow skipping, but at least one service is recommended
            console.log('No services selected, but continuing anyway');
        }

        setLoading(true);
        try {
            // Save selected services to user preferences
            if (user) {
                await authService.saveUserPreferences({
                    subscribed_services: selectedServices,
                });
            }
            
            // Navigate to next step (Budget)
            router.push('/(onboarding)/budget');
        } catch (error) {
            console.error('Error saving services:', error);
            // Still navigate even if save fails
            router.push('/(onboarding)/budget');
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
            <Image source={{ uri: item.icon }} style={styles.serviceIcon} />
            <View style={styles.serviceOverlay}>
                {selectedServices.includes(item.id) && (
                    <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                )}
            </View>
            <Text style={styles.serviceName}>{item.name}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Select Your Services</Text>
            <Text style={styles.subtitle}>Select the streaming services you use to get personalized recommendations.</Text>

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
                    {loading ? 'Saving...' : 'Continue'}
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
        aspectRatio: 1,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: Colors.surface,
    },
    serviceCardSelected: {
        borderWidth: 3,
        borderColor: Colors.primary,
    },
    serviceIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    serviceOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmark: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    serviceName: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
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
