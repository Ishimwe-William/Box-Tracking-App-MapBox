import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles';

export type StatusType = 'delivered' | 'pending' | 'box_open' | 'box_closed' | 'unassigned' | 'admin' | 'user';

const STATUS_CONFIG: Record<StatusType, {
    label: string; color: string; bg: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
}> = {
    delivered:  { label: 'Delivered',  color: COLORS.success,       bg: '#f0faf5', icon: 'checkmark-circle' },
    pending:    { label: 'Pending',    color: '#f59e0b',             bg: '#fffbeb', icon: 'time' },
    box_open:   { label: 'Box Open',   color: COLORS.primary,        bg: '#e8f4f7', icon: 'lock-open' },
    box_closed: { label: 'Box Closed', color: COLORS.textSecondary,  bg: COLORS.border, icon: 'lock-closed' },
    unassigned: { label: 'No Box',     color: COLORS.textMuted,      bg: COLORS.border, icon: 'help-circle' },
    admin:      { label: 'Admin',      color: COLORS.primary,        bg: '#e8f4f7', icon: 'shield-checkmark' },
    user:       { label: 'User',       color: COLORS.textSecondary,  bg: COLORS.border, icon: 'person' },
};

interface StatusBadgeProps {
    status: StatusType;
    showIcon?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = false }) => {
    const config = STATUS_CONFIG[status];
    return (
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
            {showIcon && <Ionicons name={config.icon} size={11} color={config.color} style={{ marginRight: 4 }} />}
            <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
        </View>
    );
};

export default StatusBadge;

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});