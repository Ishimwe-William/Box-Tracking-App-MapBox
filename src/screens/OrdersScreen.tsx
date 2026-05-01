import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, ActivityIndicator, RefreshControl,
    TouchableOpacity, Alert, Modal, TextInput, StyleSheet,
} from 'react-native';
import {
    collection, addDoc, deleteDoc, query, where,
    getDocs, Timestamp, updateDoc, doc, orderBy,
} from 'firebase/firestore';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { db, rtdb } from '../config/firebaseConfig';
import { styles as globalStyles, COLORS } from '../styles/styles';
import { useAuth } from '../context/authContext';
import MyButton from '../components/MyButton';
import MySmallButton from '../components/MySmallButton';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { updateBoxStatus } from '../utils/rtdbUtils';
import { sendNotificationEmail } from '../utils/emailService';
import { Ionicons } from '@expo/vector-icons';
import DeliveryLocationPicker, { PickedLocation } from '../components/DeliveryLocationPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Order = {
    id: string;
    email: string;
    timestamp: Timestamp;
    location: { latitude?: string; longitude?: string };
    boxId: string;
    orderId: string;
    status: boolean | null;
    delivered: boolean;
    adminConfirmedDelivery?: boolean;
    adminConfirmedAt?: Timestamp;
    deliveryAddress?: string;
    deliveryLatitude?: string;
    deliveryLongitude?: string;
};

type OrderStackParamList = {
    MapScreen: { order: Order };
    OrderScreen: undefined;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const OrderHeader: React.FC<{ order: Order; isAdmin: boolean }> = ({ order, isAdmin }) => (
    <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
            <Text style={cardStyles.orderId}>#{order.orderId?.slice(-10) ?? order.id.slice(-10)}</Text>
            {isAdmin && <Text style={cardStyles.email} numberOfLines={1}>{order.email}</Text>}
        </View>
        <StatusBadge
            status={order.delivered ? 'delivered' : (!order.boxId ? 'unassigned' : 'pending')}
            showIcon
        />
    </View>
);

const MetaItem: React.FC<{
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    color: string;
}> = ({ icon, label, color }) => (
    <View style={cardStyles.metaItem}>
        <Ionicons name={icon} size={13} color={color} style={{ marginRight: 5 }} />
        <Text style={[cardStyles.metaText, { color }]}>{label}</Text>
    </View>
);

const OrderMeta: React.FC<{ order: Order }> = ({ order }) => (
    <View style={cardStyles.meta}>
        <MetaItem
            icon="cube-outline"
            label={order.boxId ? `Box: ${order.boxId}` : 'No box assigned'}
            color={order.boxId ? COLORS.textSecondary : COLORS.textMuted}
        />
        <MetaItem
            icon="time-outline"
            label={order.timestamp?.toDate().toLocaleString() ?? '—'}
            color={COLORS.textMuted}
        />
        {!!order.deliveryAddress && (
            <MetaItem icon="location-outline" label={order.deliveryAddress} color={COLORS.textSecondary} />
        )}
        {!order.delivered && order.boxId && (
            <MetaItem
                icon={order.status ? 'lock-open-outline' : 'lock-closed-outline'}
                label={order.status === null ? 'Status unknown' : (order.status ? 'Box is open' : 'Box is closed')}
                color={order.status ? COLORS.success : COLORS.textSecondary}
            />
        )}
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const OrdersScreen: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [isBoxModalVisible, setIsBoxModalVisible] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [orderBoxId, setOrderBoxId] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
    const [orders, setOrders] = useState<Order[]>([]);
    const { user, userRole } = useAuth();
    const navigation = useNavigation<StackNavigationProp<OrderStackParamList>>();
    const [listenerCleanups, setListenerCleanups] = useState<(() => void)[]>([]);

    const showBoxModal = (item: Order) => { setSelectedOrder(item); setIsBoxModalVisible(true); };
    const hideBoxModal = () => { setIsBoxModalVisible(false); setOrderBoxId(''); };

    // ── Fetch orders ──

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            listenerCleanups.forEach(fn => fn());

            const q = userRole === 'Admin'
                ? query(collection(db, 'orders'), orderBy('timestamp', 'desc'))
                : query(collection(db, 'orders'), orderBy('timestamp', 'desc'), where('email', '==', user.email));

            const snap = await getDocs(q);
            let fetchedOrders: Order[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));

            // Lazy 3-day auto-confirm
            fetchedOrders = await Promise.all(fetchedOrders.map(async (order) => {
                if (!order.delivered && order.adminConfirmedDelivery && order.adminConfirmedAt) {
                    const elapsed = (Date.now() - order.adminConfirmedAt.toDate().getTime()) / 86_400_000;
                    if (elapsed >= 3) {
                        await updateDoc(doc(db, 'orders', order.id), { delivered: true });
                        return { ...order, delivered: true };
                    }
                }
                return order;
            }));

            setOrders(fetchedOrders);

            const cleanups: (() => void)[] = [];
            fetchedOrders.forEach(order => {
                if (!order.boxId) return;
                const statusRef = ref(rtdb, `statuses/${order.boxId}/status`);
                const handler = (snapshot: DataSnapshot) => {
                    const val = snapshot.exists() ? (snapshot.val() as boolean) : null;
                    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: val } : o));
                };
                onValue(statusRef, handler);
                cleanups.push(() => off(statusRef));
            });
            setListenerCleanups(cleanups);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }, [user, userRole]);

    useEffect(() => {
        fetchOrders();
        return () => { listenerCleanups.forEach(fn => fn()); };
    }, [user]);

    // ── Place order — called when picker confirms a location ──

    const handlePlaceOrder = async (picked: PickedLocation) => {
        setIsPickerVisible(false);
        if (!user?.email) return;
        try {
            setLoading(true);
            const docRef = await addDoc(collection(db, 'orders'), {
                email: user.email,
                timestamp: Timestamp.now(),
                boxId: '',
                orderId: '',
                location: {},
                delivered: false,
                adminConfirmedDelivery: false,
                adminConfirmedAt: null,
                deliveryAddress: picked.address,
                deliveryLatitude: String(picked.latitude),
                deliveryLongitude: String(picked.longitude),
            });
            await updateDoc(docRef, { orderId: docRef.id });
            const shortId = docRef.id.slice(-10);

            sendNotificationEmail(
                user.email,
                `Order Confirmation #${shortId}`,
                `<h2>Thank you!</h2><p>Order <b>#${shortId}</b> received.</p><p>Delivery: <b>${picked.address}</b></p>`
            );

            try {
                const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'Admin')));
                const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);
                if (adminEmails.length > 0) {
                    sendNotificationEmail(
                        adminEmails.join(','),
                        `New Order: #${shortId}`,
                        `<p>Customer <b>${user.email}</b> placed order <b>#${shortId}</b>. Delivery: <b>${picked.address}</b></p>`
                    );
                }
            } catch { /* non-fatal */ }

            fetchOrders();
        } catch (err) {
            console.error('Error placing order:', err);
            Alert.alert('Error', 'Failed to place order.');
        } finally {
            setLoading(false);
        }
    };

    // ── Edit delivery address for an existing order ──

    const handleEditDelivery = (item: Order) => {
        setSelectedOrder(item);
        setIsPickerVisible(true);
    };

    const handleUpdateDelivery = async (picked: PickedLocation) => {
        setIsPickerVisible(false);
        if (!selectedOrder) return;
        try {
            setLoading(true);
            await updateDoc(doc(db, 'orders', selectedOrder.orderId), {
                deliveryAddress: picked.address,
                deliveryLatitude: String(picked.latitude),
                deliveryLongitude: String(picked.longitude),
            });
            fetchOrders();
        } catch (err) {
            console.error('Error updating delivery:', err);
            Alert.alert('Error', 'Failed to update delivery address.');
        } finally {
            setLoading(false);
        }
    };

    // selectedOrder distinguishes new order vs edit:
    // selectedOrder === undefined → new order flow
    // selectedOrder !== undefined → edit flow
    const onPickerConfirm = (picked: PickedLocation) => {
        if (selectedOrder) {
            handleUpdateDelivery(picked);
        } else {
            handlePlaceOrder(picked);
        }
    };

    const openNewOrderPicker = () => {
        setSelectedOrder(undefined);
        setIsPickerVisible(true);
    };

    // ── Other handlers ──

    const handleDeleteOrder = (item: Order) => {
        Alert.alert('Delete Order', 'Permanently delete this order?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await deleteDoc(doc(db, 'orders', item.orderId)); fetchOrders(); }
                    catch (err) { console.error(err); }
                },
            },
        ]);
    };

    const handleProcessOrder = (item: Order) => {
        Alert.alert('Notify Customer', 'Mark as delivered? Customer has 3 days to confirm.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Notify',
                onPress: async () => {
                    try {
                        setLoading(true);
                        await updateDoc(doc(db, 'orders', item.orderId), {
                            adminConfirmedDelivery: true,
                            adminConfirmedAt: Timestamp.now(),
                        });
                        const shortId = item.orderId.slice(-10);
                        sendNotificationEmail(item.email, `Confirm Delivery #${shortId}`,
                            `<p>Admin marked your order as delivered. Please confirm in the app within 3 days.</p>`);
                        fetchOrders();
                    } catch (err) { console.error(err); }
                    finally { setLoading(false); }
                },
            },
        ]);
    };

    const handleCustomerConfirmDelivery = (item: Order) => {
        Alert.alert('Confirm Delivery', 'Mark your order as received?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Yes, received it',
                onPress: async () => {
                    try {
                        setLoading(true);
                        await updateDoc(doc(db, 'orders', item.orderId), { delivered: true });
                        const shortId = item.orderId.slice(-10);
                        sendNotificationEmail(item.email, `Delivery Confirmed #${shortId}`,
                            `<p>Order <b>#${shortId}</b> marked as received. Thank you!</p>`);
                        try {
                            const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'Admin')));
                            const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);
                            if (adminEmails.length > 0)
                                sendNotificationEmail(adminEmails.join(','), `Customer Confirmed #${shortId}`,
                                    `<p><b>${item.email}</b> confirmed delivery of <b>#${shortId}</b>.</p>`);
                        } catch { /* non-fatal */ }
                        fetchOrders();
                    } catch (err) {
                        console.error(err);
                        Alert.alert('Error', 'Failed to confirm delivery.');
                    } finally { setLoading(false); }
                },
            },
        ]);
    };

    const handleAddBoxId = async () => {
        if (!selectedOrder || !orderBoxId.trim()) return;
        const newBoxId = orderBoxId.trim();

        try {
            setLoading(true);

            // 1. Check if the box is already assigned to an undelivered order
            const activeBoxQuery = query(
                collection(db, 'orders'),
                where('boxId', '==', newBoxId),
                where('delivered', '==', false)
            );
            const activeBoxSnap = await getDocs(activeBoxQuery);

            if (!activeBoxSnap.empty) {
                Alert.alert(
                    'Box Unavailable',
                    `Box ${newBoxId} is currently assigned to another order that has not been delivered yet.`
                );
                setLoading(false);
                return; // Stop the function here and keep the modal open
            }

            // 2. If the box is free, proceed with the assignment
            await updateDoc(doc(db, 'orders', selectedOrder.orderId), { boxId: newBoxId });
            const shortId = selectedOrder.orderId.slice(-10);
            sendNotificationEmail(selectedOrder.email, `Box Assigned #${shortId}`,
                `<p>Order <b>#${shortId}</b> is in Box <b>${newBoxId}</b>.</p>`);

            fetchOrders();
            hideBoxModal(); // Only close the modal on success
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to assign box ID.');
            hideBoxModal();
        } finally {
            setLoading(false);
        }
    };

    const handleToggleBox = (item: Order) => {
        if (!item.boxId) return;
        const newStatus = !item.status;
        Alert.alert(`${newStatus ? 'Open' : 'Close'} Box`, `Send signal to box ${item.boxId}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: () => {
                    updateBoxStatus(item.boxId, newStatus);
                    if (userRole !== 'Admin')
                        sendNotificationEmail(item.email, `Box ${item.boxId} ${newStatus ? 'Opened' : 'Closed'}`,
                            `<p>Your box was ${newStatus ? 'opened' : 'closed'}.</p>`);
                },
            },
        ]);
    };

    // ── Render item ──

    const renderItem = ({ item }: { item: Order }) => {
        const isFullyDelivered = item.delivered;
        const isAwaitingCustomer = !isFullyDelivered && item.adminConfirmedDelivery;

        return (
            <View style={cardStyles.card}>
                <OrderHeader order={item} isAdmin={userRole === 'Admin'} />
                {!isFullyDelivered && <OrderMeta order={item} />}

                {isFullyDelivered && (
                    <View style={cardStyles.deliveredBanner}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                        <Text style={cardStyles.deliveredText}>Delivered</Text>
                    </View>
                )}
                {isAwaitingCustomer && (
                    <View style={[cardStyles.deliveredBanner, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="time" size={14} color="#d97706" />
                        <Text style={[cardStyles.deliveredText, { color: '#d97706' }]}>
                            Awaiting Your Confirmation
                        </Text>
                    </View>
                )}

             <View style={cardStyles.actions}>
                    {!isFullyDelivered && item.boxId && (
                        <TouchableOpacity
                            style={[cardStyles.boxBtn, { borderColor: item.status ? COLORS.success : COLORS.primary }]}
                            onPress={() => handleToggleBox(item)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={item.status ? 'lock-open' : 'lock-closed'}
                                size={14}
                                color={item.status ? COLORS.success : COLORS.primary}
                            />
                            <Text style={[cardStyles.boxBtnText, { color: item.status ? COLORS.success : COLORS.primary }]}>
                                {item.status ? 'Close Box' : 'Open Box'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={cardStyles.actions}>
                    <View style={cardStyles.iconActions}>
                        {/* Track on map */}
                        {!isFullyDelivered && item.boxId && (
                            <MySmallButton
                                handleSubmit={() => navigation.navigate('MapScreen', { order: item })}
                                color={COLORS.primary} iconName="location" size={22} isLoading={loading}
                            />
                        )}
                        {/* Edit delivery pin */}
                        {!isFullyDelivered && (
                            <MySmallButton
                                handleSubmit={() => handleEditDelivery(item)}
                                color="#8B5CF6" iconName="pencil" size={22} isLoading={loading}
                            />
                        )}

                        {userRole === 'Admin' ? (
                            <>
                                {!isFullyDelivered && (
                                    <MySmallButton
                                        handleSubmit={() => showBoxModal(item)}
                                        color="#6366f1" iconName="cube" size={22} isLoading={loading}
                                    />
                                )}
                                {!isFullyDelivered && !item.adminConfirmedDelivery && (
                                    <MySmallButton
                                        handleSubmit={() => handleProcessOrder(item)}
                                        color={COLORS.success} iconName="paper-plane" size={22} isLoading={loading}
                                    />
                                )}
                                <MySmallButton
                                    handleSubmit={() => handleDeleteOrder(item)}
                                    color={COLORS.error} iconName="trash" size={22} isLoading={loading}
                                />
                            </>
                        ) : (
                            !isFullyDelivered && (
                                <MySmallButton
                                    handleSubmit={() => handleCustomerConfirmDelivery(item)}
                                    color={COLORS.success} iconName="checkmark-done-circle" size={22} isLoading={loading}
                                />
                            )
                        )}
                    </View>
                </View>
            </View>
        );
    };

    // ── Render ──

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>

            {/* Assign Box Modal */}
            <Modal visible={isBoxModalVisible} animationType="fade" transparent>
                <View style={globalStyles.modalContainer}>
                    <View style={globalStyles.modalContent}>
                        <Text style={globalStyles.modalTitle}>Assign Box ID</Text>
                        <Text style={globalStyles.modalSubtitle}>Order #{selectedOrder?.orderId?.slice(-10)}</Text>
                        <Text style={globalStyles.inputLabel}>Box ID</Text>
                        <TextInput
                            style={globalStyles.textInput}
                            placeholder={selectedOrder?.boxId ? `Current: ${selectedOrder.boxId}` : 'Enter box ID'}
                            placeholderTextColor={COLORS.textMuted}
                            onChangeText={setOrderBoxId}
                            value={orderBoxId}
                            autoCapitalize="none"
                        />
                        <View style={localStyles.modalRow}>
                            <TouchableOpacity
                                style={[localStyles.modalBtn, { backgroundColor: COLORS.primary }]}
                                onPress={handleAddBoxId}
                                disabled={loading || !orderBoxId.trim()}
                            >
                                {loading
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={localStyles.modalBtnText}>Assign</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[localStyles.modalBtn, { backgroundColor: COLORS.border }]}
                                onPress={hideBoxModal}
                            >
                                <Text style={[localStyles.modalBtnText, { color: COLORS.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delivery Location Picker */}
            <DeliveryLocationPicker
                visible={isPickerVisible}
                onConfirm={onPickerConfirm}
                onCancel={() => setIsPickerVisible(false)}
            />

            <View style={localStyles.topBar}>
                <MyButton title="+ Place New Order" handleSubmit={openNewOrderPicker} isLoading={loading} />
            </View>

            {loading && orders.length === 0 ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchOrders} colors={[COLORS.primary]} />
                    }
                    ListHeaderComponent={
                        <SectionHeader
                            title={userRole === 'Admin' ? 'All Orders' : 'Your Orders'}
                            subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''}`}
                        />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="cube-outline"
                            title="No orders found"
                            subtitle="Tap '+ Place New Order' to get started."
                        />
                    }
                />
            )}
        </View>
    );
};

export default OrdersScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        marginHorizontal: 16, marginVertical: 5,
        borderRadius: 16, padding: 14,
        borderWidth: 1.5, borderColor: COLORS.border,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 6,
        elevation: 2,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 10,
    },
    headerLeft: { flex: 1, marginRight: 10 },
    orderId: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.2 },
    email: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    meta: { gap: 5, marginBottom: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontSize: 12, fontWeight: '500' },
    deliveredBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        marginBottom: 10, backgroundColor: COLORS.successLight,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    deliveredText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
    actions: {
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'center', marginTop: 4,
        borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
    },
    boxBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 10, borderWidth: 1.5,
    },
    boxBtnText: { fontSize: 12, fontWeight: '700' },
    iconActions: {
        flexDirection: 'row',
    },
});

const localStyles = StyleSheet.create({
    topBar: {
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
        backgroundColor: COLORS.background,
    },
    modalRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { fontWeight: '700', fontSize: 14, color: '#fff' },
});