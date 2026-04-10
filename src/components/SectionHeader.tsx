import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../styles/styles';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, actionLabel, onAction }) => (
    <View style={styles.container}>
        <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {actionLabel && onAction && (
            <TouchableOpacity onPress={onAction} style={styles.action}>
                <Text style={styles.actionText}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

export default SectionHeader;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    action: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: COLORS.primaryLight,
        borderRadius: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
});