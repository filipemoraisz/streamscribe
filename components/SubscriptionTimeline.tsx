import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { OptimizationPlan, SubscriptionAction } from '../services/optimizer';
import { tmdbService } from '../services/tmdb';

interface Props {
    plan: OptimizationPlan;
    onRecalculate: () => void;
}

import { ImpactHeader } from './ImpactHeader';

export function SubscriptionTimeline({ plan, onRecalculate }: Props) {
    const renderActionCard = (action: SubscriptionAction, isCurrent: boolean) => {
        const isSwitch = action.action === 'SWITCH';
        const isStart = action.action === 'START';

        return (
            <View style={[styles.card, isCurrent && styles.currentCard]}>
                <View style={styles.timelineConnector}>
                    <View style={[styles.dot, isCurrent && styles.currentDot]} />
                    <View style={styles.line} />
                </View>

                <View style={styles.cardContent}>
                    <View style={styles.headerRow}>
                        <Text style={styles.monthText}>{action.month} {action.year}</Text>
                        {action.savings > 0 && (
                            <View style={styles.savingsBadge}>
                                <Text style={styles.savingsText}>Save ${action.savings.toFixed(2)}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.actionRow}>
                        {isSwitch && action.previousProvider && (
                            <View style={styles.switchContainer}>
                                <View style={styles.providerBadge}>
                                    <Text style={styles.cancelText}>Cancel {action.previousProvider.name}</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} style={styles.arrowIcon} />
                            </View>
                        )}

                        <View style={styles.mainAction}>
                            <View style={styles.providerInfo}>
                                {action.provider.logoUrl ? (
                                    <Image
                                        source={{ uri: tmdbService.getImageURL(action.provider.logoUrl, 'w92') || undefined }}
                                        style={styles.providerLogo}
                                    />
                                ) : (
                                    <View style={styles.placeholderLogo} />
                                )}
                                <View>
                                    <Text style={styles.actionTitle}>
                                        {isStart ? 'Start' : 'Switch to'} {action.provider.name}
                                    </Text>
                                    <Text style={styles.costText}>${action.provider.cost}/mo</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.reasoningText}>{action.reasoning}</Text>

                    <View style={styles.contentPreview}>
                        <Text style={styles.contentPreviewTitle}>Watchlist items:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.posterScroll}>
                            {action.contentToWatch.map(item => (
                                <Image
                                    key={item.id}
                                    source={{ uri: tmdbService.getImageURL(item.poster_path, 'w154') || undefined }}
                                    style={styles.poster}
                                />
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <ImpactHeader
                totalSavings={plan.totalAnnualSavings}
                efficiency={plan.averageEfficiency}
                streak={plan.currentStreak}
            />

            <TouchableOpacity style={styles.recalculateButton} onPress={onRecalculate}>
                <Ionicons name="refresh" size={20} color={Colors.text} />
                <Text style={styles.recalculateText}>Recalculate Plan</Text>
            </TouchableOpacity>

            <ScrollView style={styles.timelineScroll} contentContainerStyle={styles.timelineContent}>
                {renderActionCard(plan.currentMonth, true)}
                {plan.upcomingMonths.map((month, index) => (
                    <React.Fragment key={index}>
                        {renderActionCard(month, false)}
                    </React.Fragment>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        margin: 16,
        borderRadius: 12,
        padding: 16,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginBottom: 4,
    },
    summaryValue: {
        color: Colors.primary,
        fontSize: 24,
        fontWeight: 'bold',
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.border,
    },
    recalculateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.card,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    recalculateText: {
        color: Colors.text,
        marginLeft: 8,
        fontWeight: '600',
    },
    timelineScroll: {
        flex: 1,
    },
    timelineContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    currentCard: {
        // Highlight current month
    },
    timelineConnector: {
        alignItems: 'center',
        marginRight: 16,
        width: 20,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.textMuted,
        marginTop: 6,
    },
    currentDot: {
        backgroundColor: Colors.primary,
        width: 16,
        height: 16,
        borderRadius: 8,
        marginTop: 4,
        borderWidth: 2,
        borderColor: Colors.background,
    },
    line: {
        flex: 1,
        width: 2,
        backgroundColor: Colors.border,
        marginTop: 4,
    },
    cardContent: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    savingsBadge: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    savingsText: {
        color: Colors.success,
        fontSize: 12,
        fontWeight: '600',
    },
    actionRow: {
        marginBottom: 12,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    providerBadge: {
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    cancelText: {
        color: Colors.error,
        fontSize: 12,
        fontWeight: '600',
    },
    arrowIcon: {
        marginHorizontal: 8,
    },
    mainAction: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerLogo: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: Colors.card,
    },
    placeholderLogo: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: Colors.card,
    },
    actionTitle: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    costText: {
        color: Colors.textMuted,
        fontSize: 14,
    },
    reasoningText: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    contentPreview: {
        marginTop: 8,
    },
    contentPreviewTitle: {
        color: Colors.textMuted,
        fontSize: 12,
        marginBottom: 8,
    },
    posterScroll: {
        flexDirection: 'row',
    },
    poster: {
        width: 60,
        height: 90,
        borderRadius: 4,
        marginRight: 8,
        backgroundColor: Colors.card,
    },
});
