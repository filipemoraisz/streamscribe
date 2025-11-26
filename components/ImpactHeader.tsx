import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
    totalSavings: number;
    efficiency: number;
    streak: number;
}

export function ImpactHeader({ totalSavings, efficiency, streak }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <View style={styles.statItem}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="wallet" size={20} color={Colors.success} />
                    </View>
                    <View>
                        <Text style={styles.label}>Projected Savings</Text>
                        <Text style={styles.value}>${totalSavings.toFixed(0)}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="time" size={20} color={Colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.label}>Efficiency</Text>
                        <Text style={styles.value}>${efficiency.toFixed(2)}/hr</Text>
                    </View>
                </View>
            </View>

            {streak > 0 && (
                <View style={styles.streakContainer}>
                    <Ionicons name="flame" size={16} color={Colors.warning} />
                    <Text style={styles.streakText}>{streak} Month Optimization Streak!</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        margin: 16,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    label: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.border,
        marginHorizontal: 16,
    },
    streakContainer: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        padding: 8,
        borderRadius: 8,
    },
    streakText: {
        color: Colors.warning,
        fontWeight: '600',
        marginLeft: 8,
        fontSize: 14,
    },
});
