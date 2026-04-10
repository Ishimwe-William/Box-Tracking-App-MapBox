import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles';

type SettingRowType = 'chevron' | 'toggle' | 'info' | 'action';

interface SettingRowProps {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconColor?: string;
    label: string;
    value?: string;
    type?: SettingRowType;
    toggleValue?: boolean;
    onToggle?: (val: boolean) => void;
    onPress?: () => void;
    danger?: boolean;
    badge?: string;
    last?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({
                                                   icon, iconColor = COLORS.textSecondary, label, value,
                                                   type = 'chevron', toggleValue, onToggle, onPress,
                                                   danger, badge, last,
                                               }) => {
    const labelColor = danger ? COLORS.error : COLORS.textPrimary;
    const effectiveIconColor = danger ? COLORS.error : iconColor;

    const inner = (
        <View style={[styles.row, last && styles.last]}>
            <View style={[styles.iconBox, { backgroundColor: effectiveIconColor + '15' }]}>
                <Ionicons name={icon} size={18} color={effectiveIconColor} />
            </View>
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
            {badge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}
            <View style={styles.right}>
                {type === 'info' && value && <Text style={styles.value}>{value}</Text>}
                {type === 'toggle' && (
                    <Switch
                        value={toggleValue}
                        onValueChange={onToggle}
                        trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        thumbColor="#fff"
                    />
                )}
                {type === 'chevron' && (
                    <>
                        {value && <Text style={styles.value}>{value}</Text>}
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                    </>
                )}
                {type === 'action' && value && (
                    <Text style={[styles.value, { color: danger ? COLORS.error : COLORS.primary }]}>{value}</Text>
                )}
            </View>
        </View>
    );

    if (type === 'toggle' || type === 'info') {
        return <View style={styles.container}>{inner}</View>;
    }

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
            {inner}
        </TouchableOpacity>
    );
};

export default SettingRow;

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingVertical: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    last: {
        borderBottomWidth: 0,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    label: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
        color: COLORS.textPrimary,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    value: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginRight: 2,
    },
    badge: {
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
        marginRight: 8,
    },
    badgeText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '700',
    },
});