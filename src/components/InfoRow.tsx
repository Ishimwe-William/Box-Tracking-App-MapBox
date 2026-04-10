import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles';

interface InfoRowProps {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
    valueColor?: string;
    last?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, valueColor, last }) => (
    <View style={[styles.row, last && styles.last]}>
        <View style={styles.left}>
            <View style={styles.iconBox}>
                <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
            {value}
        </Text>
    </View>
);

export default InfoRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingHorizontal: 16,
    },
    last: { borderBottomWidth: 0 },
    left: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceAlt,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    label: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
    value: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '600',
        maxWidth: '55%',
        textAlign: 'right',
    },
});