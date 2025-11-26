import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth';

export default function BudgetScreen() {
    const { refreshPreferences } = useAuth();
    const [budget, setBudget] = useState('50');
    const [loading, setLoading] = useState(false);

    const handleFinish = async () => {
        setLoading(true);
        try {
            const budgetNum = parseFloat(budget) || 0;
            await authService.saveUserPreferences({
                monthly_budget: budgetNum,
                onboarding_completed: true,
            });

            await refreshPreferences();
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error saving budget:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>What is your budget?</Text>
            <Text style={styles.subtitle}>How much are you willing to spend on streaming per month?</Text>

            <View style={styles.inputContainer}>
                <Text style={styles.currency}>$</Text>
                <TextInput
                    style={styles.input}
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="numeric"
                    maxLength={4}
                />
                <Text style={styles.unit}>/ month</Text>
            </View>

            <Text style={styles.hint}>
                We'll use this to optimize your subscriptions and find you the best value.
            </Text>

            <View style={styles.spacer} />

            <TouchableOpacity style={styles.button} onPress={handleFinish} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Finishing...' : 'Finish Setup'}</Text>
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
    currency: {
        color: Colors.text,
        fontSize: 48,
        fontWeight: 'bold',
        marginRight: 8,
    },
    input: {
        backgroundColor: Colors.surface,
        color: Colors.text,
        fontSize: 48,
        fontWeight: 'bold',
        padding: 16,
        borderRadius: 12,
        width: 140,
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
