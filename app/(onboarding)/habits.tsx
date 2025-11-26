import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { authService } from '../../services/auth';

export default function HabitsScreen() {
    const [hours, setHours] = useState('10');
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        setLoading(true);
        try {
            const hoursNum = parseInt(hours, 10) || 0;
            await authService.saveUserPreferences({
                weekly_watch_hours: hoursNum,
            });
            router.push('/(onboarding)/budget');
        } catch (error) {
            console.error('Error saving habits:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>How much do you watch?</Text>
            <Text style={styles.subtitle}>Estimate your weekly watch time for movies and TV shows.</Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="numeric"
                    maxLength={3}
                />
                <Text style={styles.unit}>hours / week</Text>
            </View>

            <Text style={styles.hint}>
                This helps us calculate how much content you need to subscribe to.
            </Text>

            <View style={styles.spacer} />

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
        marginBottom: 40,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    input: {
        backgroundColor: Colors.surface,
        color: Colors.text,
        fontSize: 48,
        fontWeight: 'bold',
        padding: 16,
        borderRadius: 12,
        width: 120,
        textAlign: 'center',
    },
    unit: {
        color: Colors.textSecondary,
        fontSize: 20,
        marginLeft: 16,
    },
    hint: {
        color: Colors.textMuted,
        textAlign: 'center',
        fontSize: 14,
    },
    spacer: {
        flex: 1,
    },
    button: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
