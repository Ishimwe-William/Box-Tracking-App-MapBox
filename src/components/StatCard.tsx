import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles';

interface StatCardProps {
    label: string;
    value: string | number;
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    color?: string;
    onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, iconName, color = COLORS.primary, onPress }) => {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
        <Wrapper style={[styles.card, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
                <Ionicons name={iconName} size={20} color={color} />
            </View>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </Wrapper>
    );
};

export default StatCard;

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 14,
        flex: 1,
        marginHorizontal: 4,
        borderTopWidth: 3,
        alignItems: 'center',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 2,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    value: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
        lineHeight: 28,
    },
    label: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 3,
        fontWeight: '600',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});