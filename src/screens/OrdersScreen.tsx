import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapboxConfig';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

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

type PinCoord = { latitude: number; longitude: number };

// ─── Reverse geocode ──────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
            `?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=address,place,neighborhood`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.features?.length > 0) return json.features[0].place_name as string;
    } catch { /* silent */ }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ─── Map pin picker modal ─────────────────────────────────────────────────────

// Default centre: Kigali [lng, lat]
const DEFAULT_REGION: [number, number] = [29.256043, -1.698774];

const DeliveryMapModal: React.FC<{
    visible: boolean;
    onConfirm: (coord: PinCoord, address: string) => void;
    onCancel: () => void;
}> = ({ visible, onConfirm, onCancel }) => {
    const [pin, setPin] = useState<PinCoord | null>(null);
    const [address, setAddress] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const cameraRef = useRef<MapboxGL.Camera>(null);

    // Reset and centre on user when modal opens
    useEffect(() => {
        if (!visible) return;
        setPin(null);
        setAddress('');
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            cameraRef.current?.setCamera({
                centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
                zoomLevel: 15,
                animationDuration: 600,
            });
        })();
    }, [visible]);

    const resolvePin = async (lat: number, lng: number) => {
        const coord = { latitude: lat, longitude: lng };
        setPin(coord);
        setGeocoding(true);
        setAddress('Locating address…');
        const resolved = await reverseGeocode(lat, lng);
        setAddress(resolved);
        setGeocoding(false);
    };

    const handleMapPress = (e: any) => {
        const [lng, lat] = e.geometry.coordinates as [number, number];
        resolvePin(lat, lng);
    };

    const handleDragEnd = (e: any) => {
        const [lng, lat] = e.geometry.coordinates as [number, number];
        resolvePin(lat, lng);
    };

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent>
            <View style={mapModalStyles.container}>

                {/* ── Header ── */}
                <View style={mapModalStyles.header}>
                    <TouchableOpacity onPress={onCancel} style={mapModalStyles.closeBtn}>
                        <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={mapModalStyles.headerCenter}>
                        <Text style={mapModalStyles.title}>Set Delivery Location</Text>
                        <Text style={mapModalStyles.subtitle}>Tap anywhere on the map</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* ── Map ── */}
                <MapboxGL.MapView
                    style={mapModalStyles.map}
                    styleURL={MapboxGL.StyleURL.Street}
                    onPress={handleMapPress}
                    compassEnabled
                    logoEnabled={false}
                    attributionEnabled={false}
                >
                    <MapboxGL.Camera
                        ref={cameraRef}
                        centerCoordinate={DEFAULT_REGION}
                        zoomLevel={13}
                        animationMode="flyTo"
                        animationDuration={600}
                    />

                    {pin && (
                        <MapboxGL.PointAnnotation
                            id="delivery-pin"
                            coordinate={[pin.longitude, pin.latitude]}
                            draggable
                            onDragEnd={handleDragEnd}
                        >
                            <View style={mapModalStyles.pinOuter}>
                                <View style={mapModalStyles.pinInner}>
                                    <Ionicons name="location" size={18} color="#fff" />
                                </View>
                                <View style={mapModalStyles.pinTail} />
                            </View>
                            <MapboxGL.Callout title="Delivery here" />
                        </MapboxGL.PointAnnotation>
                    )}
                </MapboxGL.MapView>

                {/* ── Hint overlay (no pin yet) ── */}
                {!pin && (
                    <View style={mapModalStyles.tapHint} pointerEvents="none">
                        <Ionicons name="finger-print" size={20} color={COLORS.primary} />
                        <Text style={mapModalStyles.tapHintText}>
                            Tap the map to pin your delivery spot
                        </Text>
                    </View>
                )}

                {/* ── Footer: address + confirm ── */}
                {pin && (
                    <View style={mapModalStyles.footer}>
                        <View style={mapModalStyles.addressRow}>
                            {geocoding
                                ? <ActivityIndicator size="small" color={COLORS.primary} />
                                : <Ionicons name="location" size={16} color={COLORS.primary} />
                            }
                            <Text style={mapModalStyles.addressText} numberOfLines={2}>
                                {address || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
                            </Text>
                        </View>

                        <Text style={mapModalStyles.dragHint}>
                            You can drag the pin to fine-tune the position
                        </Text>

                        <TouchableOpacity
                            style={[mapModalStyles.confirmBtn, geocoding && { opacity: 0.55 }]}
                            onPress={() => onConfirm(pin, address)}
                            disabled={geocoding}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={mapModalStyles.confirmBtnText}>Confirm & Place Order</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
};

// ─── Order sub-components ─────────────────────────────────────────────────────

const OrderHeader: React.FC<{ order: Order; isAdmin: boolean; loading: boolean }> = ({
                                                                                         order, isAdmin,
                                                                                     }) => (
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
        {order.deliveryAddress ? (
            <MetaItem icon="location-outline" label={order.deliveryAddress} color={COLORS.textSecondary} />
        ) : null}
        {!order.delivered && order.boxId && (
            <MetaItem
                icon={order.status ? 'lock-open-outline' : 'lock-closed-outline'}
                label={order.status === null ? 'Status unknown' : (order.status ? 'Box is open' : 'Box is closed')}
                color={order.status ? COLORS.success : COLORS.textSecondary}
            />
        )}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

const OrdersScreen: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [isBoxModalVisible, setIsBoxModalVisible] = useState(false);
    const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);
    const [orderBoxId, setOrderBoxId] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
    const [orders, setOrders] = useState<Order[]>([]);
    const { user, userRole } = useAuth();
    const navigation = useNavigation<StackNavigationProp<OrderStackParamList>>();
    const [listenerCleanups, setListenerCleanups] = useState<(() => void)[]>([]);

    const showBoxModal = (item: Order) => { setSelectedOrder(item); setIsBoxModalVisible(true); };
    const hideBoxModal = () => { setIsBoxModalVisible(false); setOrderBoxId(''); };

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

            fetchedOrders = await Promise.all(fetchedOrders.map(async (order) => {
                if (!order.delivered && order.adminConfirmedDelivery && order.adminConfirmedAt) {
                    const elapsed = (Date.now() - order.adminConfirmedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
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
                if (order.boxId) {
                    const statusRef = ref(rtdb, `statuses/${order.boxId}/status`);
                    const handler = (snapshot: DataSnapshot) => {
                        const val = snapshot.exists() ? (snapshot.val() as boolean) : null;
                        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: val } : o));
                    };
                    onValue(statusRef, handler);
                    cleanups.push(() => off(statusRef));
                }
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

    // ── Called when user confirms pin on the map picker ──
    const handlePlaceOrder = async (coord: PinCoord, address: string) => {
        setIsMapPickerVisible(false);
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
                deliveryAddress: address,
                deliveryLatitude: String(coord.latitude),
                deliveryLongitude: String(coord.longitude),
            });
            await updateDoc(docRef, { orderId: docRef.id });

            const shortId = docRef.id.slice(-10);
            sendNotificationEmail(user.email, `Order Confirmation #${shortId}`,
                `<h2>Thank you!</h2><p>Order <b>#${shortId}</b> received.</p><p>Delivery: <b>${address}</b></p>`);

            try {
                const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'Admin')));
                const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);
                if (adminEmails.length > 0)
                    sendNotificationEmail(adminEmails.join(','), `New Order: #${shortId}`,
                        `<p>Customer <b>${user.email}</b> placed order <b>#${shortId}</b>. Delivery: <b>${address}</b></p>`);
            } catch { /* non-fatal */ }

            fetchOrders();
        } catch (err) {
            console.error('Error placing order:', err);
            Alert.alert('Error', 'Failed to place order.');
        } finally {
            setLoading(false);
        }
    };

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
                        sendNotificationEmail(item.email, `Confirm Delivery #${item.orderId.slice(-10)}`,
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
        try {
            setLoading(true);
            await updateDoc(doc(db, 'orders', selectedOrder.orderId), { boxId: orderBoxId.trim() });
            sendNotificationEmail(selectedOrder.email, `Box Assigned #${selectedOrder.orderId.slice(-10)}`,
                `<p>Your order is in Box <b>${orderBoxId.trim()}</b>.</p>`);
            fetchOrders();
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to assign box ID.');
        } finally { setLoading(false); hideBoxModal(); }
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

    const renderItem = ({ item }: { item: Order }) => {
        const isFullyDelivered = item.delivered;
        const isAwaitingCustomer = !isFullyDelivered && item.adminConfirmedDelivery;

        return (
            <View style={cardStyles.card}>
                <OrderHeader order={item} isAdmin={userRole === 'Admin'} loading={loading} />
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

                    <View style={cardStyles.iconActions}>
                        {!isFullyDelivered && item.boxId && (
                            <MySmallButton
                                handleSubmit={() => navigation.navigate('MapScreen', { order: item })}
                                color={COLORS.primary} iconName="location" size={22} isLoading={loading}
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

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>

            {/* ── Assign Box Modal ── */}
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

            {/* ── Map pin picker (full screen) ── */}
            <DeliveryMapModal
                visible={isMapPickerVisible}
                onConfirm={handlePlaceOrder}
                onCancel={() => setIsMapPickerVisible(false)}
            />

            <View style={localStyles.topBar}>
                <MyButton
                    title="+ Place New Order"
                    handleSubmit={() => setIsMapPickerVisible(true)}
                    isLoading={loading}
                />
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
                            subtitle="Tap 'Place New Order' to get started."
                        />
                    }
                />
            )}
        </View>
    );
};

export default OrdersScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const mapModalStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    closeBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: COLORS.background,
        justifyContent: 'center', alignItems: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

    map: { flex: 1 },

    tapHint: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    tapHintText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },

    // Custom pin shape
    pinOuter: { alignItems: 'center' },
    pinInner: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25, shadowRadius: 6,
        elevation: 6,
        borderWidth: 3, borderColor: '#fff',
    },
    pinTail: {
        width: 0, height: 0,
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: COLORS.primary,
        marginTop: -1,
    },

    footer: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08, shadowRadius: 10,
        elevation: 10,
    },
    addressRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        gap: 10, marginBottom: 4,
    },
    addressText: {
        flex: 1, fontSize: 14, fontWeight: '600',
        color: COLORS.textPrimary, lineHeight: 20,
    },
    dragHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 14, marginTop: 2 },
    confirmBtn: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        paddingVertical: 15, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

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
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 4,
        borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
    },
    boxBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 10, borderWidth: 1.5,
    },
    boxBtnText: { fontSize: 12, fontWeight: '700' },
    iconActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
});

const localStyles = StyleSheet.create({
    topBar: {
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
        backgroundColor: COLORS.background,
    },
    modalRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { fontWeight: '700', fontSize: 14, color: '#fff' },
});