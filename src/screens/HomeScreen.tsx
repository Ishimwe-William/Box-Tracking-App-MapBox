import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useAuth } from '../context/authContext';
import { styles as globalStyles, COLORS } from '../styles/styles';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import StatusBadge from '../components/StatusBadge';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../navigation/MyTabs';
import { Ionicons } from '@expo/vector-icons';
import { Order } from './OrdersScreen';

type Stats = { total: number; active: number; delivered: number };

function HomeScreen() {
    const { user, userRole } = useAuth();
    const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, delivered: 0 });
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const q = userRole === 'Admin'
                ? query(collection(db, 'orders'))
                : query(collection(db, 'orders'), where('email', '==', user.email));

            const snap = await getDocs(q);
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));

            setStats({
                total: all.length,
                active: all.filter(o => !o.delivered).length,
                delivered: all.filter(o => o.delivered).length,
            });

            // Show 3 most recent
            const sorted = [...all].sort((a, b) =>
                b.timestamp?.toMillis() - a.timestamp?.toMillis()
            );
            setRecentOrders(sorted.slice(0, 3));
        } catch (err) {
            console.error('Error fetching dashboard data', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, userRole]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <ScrollView
            style={localStyles.container}
            contentContainerStyle={globalStyles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Hero / Greeting ── */}
            <View style={localStyles.hero}>
                <View style={localStyles.heroLeft}>
                    <Text style={localStyles.greeting}>{greeting()},</Text>
                    <Text style={localStyles.email} numberOfLines={1}>
                        {user?.email?.split('@')[0] ?? 'User'}
                    </Text>
                    {userRole === 'Admin' && (
                        <View style={localStyles.adminTag}>
                            <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
                            <Text style={localStyles.adminTagText}>Administrator</Text>
                        </View>
                    )}
                </View>
                <View style={localStyles.logoBox}>
                    <Ionicons name="cube" size={32} color={COLORS.primary} />
                </View>
            </View>

            {/* ── Stats Row ── */}
            {loading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
            ) : (
                <View style={localStyles.statsRow}>
                    <StatCard
                        label="Total Orders"
                        value={stats.total}
                        iconName="layers"
                        color={COLORS.primary}
                        onPress={() => navigation.navigate('Orders')}
                    />
                    <StatCard
                        label="Active"
                        value={stats.active}
                        iconName="time"
                        color="#f59e0b"
                        onPress={() => navigation.navigate('Orders')}
                    />
                    <StatCard
                        label="Delivered"
                        value={stats.delivered}
                        iconName="checkmark-circle"
                        color={COLORS.success}
                        onPress={() => navigation.navigate('Orders')}
                    />
                </View>
            )}

            {/* ── Quick Actions ── */}
            <SectionHeader title="Quick Actions" />
            <View style={localStyles.actionsGrid}>
                <QuickAction
                    icon="cart"
                    label="Place Order"
                    color={COLORS.primary}
                    onPress={() => navigation.navigate('Orders')}
                />
                <QuickAction
                    icon="list"
                    label="My Orders"
                    color="#f59e0b"
                    onPress={() => navigation.navigate('Orders')}
                />
                <QuickAction
                    icon="person-circle"
                    label="Profile"
                    color={COLORS.success}
                    onPress={() => navigation.navigate('Profile')}
                />
                {userRole === 'Admin' && (
                    <QuickAction
                        icon="settings"
                        label="Admin"
                        color={COLORS.primaryDark}
                        onPress={() => navigation.navigate('AdminPanel')}
                    />
                )}
            </View>

            {/* ── Recent Orders ── */}
            <SectionHeader
                title="Recent Orders"
                subtitle={`Showing last ${recentOrders.length} orders`}
                actionLabel="See All"
                onAction={() => navigation.navigate('Orders')}
            />

            {recentOrders.length === 0 ? (
                <View style={localStyles.emptyRecent}>
                    <Ionicons name="cube-outline" size={28} color={COLORS.textMuted} />
                    <Text style={localStyles.emptyText}>No orders yet</Text>
                </View>
            ) : (
                recentOrders.map(order => (
                    <RecentOrderRow key={order.id} order={order} />
                ))
            )}

            {/* ── App Info ── */}
            <View style={localStyles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.textMuted} />
                <Text style={localStyles.infoText}>
                    BoxTrack — Real-time parcel tracking via GPS. Orders update automatically.
                </Text>
            </View>
        </ScrollView>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const QuickAction: React.FC<{
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    color: string;
    onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
    <TouchableOpacity style={localStyles.quickAction} onPress={onPress} activeOpacity={0.8}>
        <View style={[localStyles.qaIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={localStyles.qaLabel}>{label}</Text>
    </TouchableOpacity>
);

const RecentOrderRow: React.FC<{ order: Order }> = ({ order }) => {
    const statusType = order.delivered ? 'delivered' : (!order.boxId ? 'unassigned' : 'pending');
    return (
        <View style={localStyles.recentRow}>
            <View style={localStyles.recentIcon}>
                <Ionicons
                    name={order.delivered ? 'checkmark-circle' : 'cube'}
                    size={20}
                    color={order.delivered ? COLORS.success : COLORS.primary}
                />
            </View>
            <View style={localStyles.recentContent}>
                <Text style={localStyles.recentId} numberOfLines={1}>
                    #{order.orderId?.slice(-8) ?? order.id.slice(-8)}
                </Text>
                <Text style={localStyles.recentDate}>
                    {order.timestamp?.toDate().toLocaleDateString() ?? '—'}
                </Text>
            </View>
            <StatusBadge status={statusType} showIcon />
        </View>
    );
};

export default HomeScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const { primaryDark, surface, border, shadow, textPrimary, textSecondary, textMuted, background, primary, primaryLight } = COLORS;

const localStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: background },

    hero: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 16,
        backgroundColor: surface,
        borderRadius: 18,
        padding: 20,
        borderWidth: 1.5,
        borderColor: border,
        shadowColor: shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 2,
    },
    heroLeft: { flex: 1 },
    greeting: { fontSize: 13, color: textMuted, fontWeight: '500' },
    email: { fontSize: 20, fontWeight: '700', color: textPrimary, letterSpacing: -0.4, marginTop: 2 },
    adminTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 6,
        alignSelf: 'flex-start',
        gap: 4,
    },
    adminTagText: { fontSize: 11, fontWeight: '700', color: primary },
    logoBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },

    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginBottom: 4,
    },

    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        marginBottom: 4,
    },
    quickAction: {
        width: '46%',
        margin: '2%',
        backgroundColor: surface,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: border,
        shadowColor: shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    qaIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    qaLabel: { fontSize: 13, fontWeight: '600', color: textPrimary, textAlign: 'center' },

    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: surface,
        marginHorizontal: 16,
        marginVertical: 4,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: border,
    },
    recentIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    recentContent: { flex: 1 },
    recentId: { fontSize: 14, fontWeight: '600', color: textPrimary },
    recentDate: { fontSize: 12, color: textMuted, marginTop: 2 },

    emptyRecent: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 6,
    },
    emptyText: { fontSize: 13, color: textMuted },

    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 14,
        backgroundColor: primaryLight,
        borderRadius: 12,
        gap: 8,
    },
    infoText: { fontSize: 12, color: textSecondary, flex: 1, lineHeight: 18 },
});