import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth';

// Mock list of popular services
const POPULAR_SERVICES = [
    { id: '8', name: 'Netflix', logo: '/t2yyOv40HZeVfYjJsSlp2rhr6sf.jpg' },
    { id: '9', name: 'Amazon Prime Video', logo: '/emthp39XA2YScoU8vk5gafjQ2sV.jpg' },
    { id: '337', name: 'Disney Plus', logo: '/7qe34O2pBaJ79hTw469wdgQDv6n.jpg' },
    { id: '1899', name: 'Max', logo: '/6Q3ZYbjqsoLxi0p763C998r818c.jpg' },
    { id: '15', name: 'Hulu', logo: '/zxrVdFjIjLqkfnwyghnfkwW3qbk.jpg' },
    { id: '384', name: 'Peacock', logo: '/gN6K2lW010E08W53vP6e9x81f.jpg' },
    { id: '350', name: 'Apple TV Plus', logo: '/2E03IAfX1V0OlqJkUPiM6e8jD6.jpg' },
    { id: '531', name: 'Paramount Plus', logo: '/h5DcR0J2EESLitnhR8xLG1QYlAo.jpg' },
];

export default function ServicesScreen() {
    const { user } = useAuth();
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleService = (id: string) => {
        if (selectedServices.includes(id)) {
            setSelectedServices(selectedServices.filter(s => s !== id));
        } else {
            setSelectedServices([...selectedServices, id]);
        }
    };

    const handleNext = async () => {
        setLoading(true);
        try {
            // Save partial preferences
            await authService.saveUserPreferences({
                subscribed_services: selectedServices,
            });
            router.push('/(onboarding)/habits');
        } catch (error) {
            console.error('Error saving services:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isSelected = selectedServices.includes(item.id);
        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => toggleService(item.id)}
            >
                <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w92${item.logo}` }}
                    style={styles.logo}
                />
                <Text style={[styles.name, isSelected && styles.selectedName]}>{item.name}</Text>
                {isSelected && (
                    <View style={styles.checkIcon}>
                        <Text style={styles.checkText}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>What do you subscribe to?</Text>
            <Text style={styles.subtitle}>Select the services you currently have access to.</Text>

            <FlatList
                data={POPULAR_SERVICES}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={2}
                contentContainerStyle={styles.list}
            />

            <TouchableOpacity style={styles.button} onPress={handleNext} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Next'}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: 24,
    },
    list: {
        paddingBottom: 80,
    },
    card: {
        flex: 1,
        backgroundColor: Colors.surface,
        margin: 8,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: 'rgba(30, 136, 229, 0.1)',
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginBottom: 12,
    },
    name: {
        color: Colors.text,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '600',
    },
    selectedName: {
        color: Colors.primary,
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: Colors.primary,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
