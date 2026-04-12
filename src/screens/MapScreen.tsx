import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    Animated, Dimensions,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Order } from './OrdersScreen';
import { listenToRecentLocation, LocationData } from '../utils/rtdbUtils';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapboxConfig';
import DeliveryLocationPicker, { PickedLocation } from '../components/DeliveryLocationPicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreConfig = {
    storeName: string;
    address: string;
    latitude: string;
    longitude: string;
};

type LatLng = { latitude: number; longitude: number };

type LegendItem = {
    color: string;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
};

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
    primary:   '#4F46E5',
    store:     '#10B981',
    delivery:  '#F59E0B',
    box:       '#EF4444',
    user:      '#3B82F6',
    surface:   '#FFFFFF',
    bg:        '#F8FAFC',
    text:      '#1E293B',
    textMuted: '#94A3B8',
    border:    '#E2E8F0',
    shadow:    '#000',
};

const DEFAULT_CENTER: LatLng = { latitude: -1.698774, longitude: 29.256043 };
const SCREEN_H = Dimensions.get('window').height;

// How many px of the info card peeks above the bottom when map is full-screen
const CARD_PEEK_HEIGHT = 68;

// ─── Directions API ───────────────────────────────────────────────────────────

async function fetchRoute(waypoints: LatLng[]): Promise<number[][] | null> {
    if (waypoints.length < 2) return null;
    try {
        const coords = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
        const url =
            `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
            `?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;
        const res  = await fetch(url);
        const json = await res.json();
        return json.routes?.[0]?.geometry?.coordinates ?? null;
    } catch { return null; }
}

// ─── Marker pin ───────────────────────────────────────────────────────────────

const MarkerPin: React.FC<{
    coordinate: [number, number];
    color: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
}> = ({ coordinate, color, icon, label }) => (
    <MapboxGL.PointAnnotation id={label} coordinate={coordinate}>
        <View style={[pinS.container, { borderColor: color }]}>
            <View style={[pinS.inner, { backgroundColor: color }]}>
                <Ionicons name={icon} size={14} color="#fff" />
            </View>
        </View>
        <MapboxGL.Callout title={label} />
    </MapboxGL.PointAnnotation>
);

// ─── Info card ────────────────────────────────────────────────────────────────

const InfoCard: React.FC<{
    order: Order;
    storeName: string;
    routeReady: boolean;
    fullScreen: boolean;
    onEditDelivery: () => void;
    onToggleFullScreen: () => void;
}> = ({ order, storeName, routeReady, fullScreen, onEditDelivery, onToggleFullScreen }) => (
    <View style={[cardS.card, fullScreen && cardS.cardSheet]}>

        {/* Drag handle — tapping it also exits full-screen */}
        <TouchableOpacity onPress={fullScreen ? onToggleFullScreen : undefined} activeOpacity={0.7}>
            <View style={cardS.handle} />
        </TouchableOpacity>

        {/* ── Order / Store / toggle row ── */}
        <View style={cardS.topRow}>
            <View style={cardS.metaGroup}>
                <View style={[cardS.dot, { backgroundColor: C.primary }]} />
                <View style={cardS.info}>
                    <Text style={cardS.label}>ORDER</Text>
                    <Text style={cardS.value} numberOfLines={1}>
                        #{order.orderId?.slice(-10)}
                    </Text>
                </View>
                <View style={cardS.divider} />
                <View style={cardS.info}>
                    <Text style={cardS.label}>STORE</Text>
                    <Text style={cardS.value} numberOfLines={1}>{storeName || '—'}</Text>
                </View>
            </View>

            {/* Expand / contract button */}
            <TouchableOpacity
                style={cardS.fsBtn}
                onPress={onToggleFullScreen}
                activeOpacity={0.75}
            >
                <Ionicons
                    name={fullScreen ? 'contract' : 'expand'}
                    size={16}
                    color={C.primary}
                />
            </TouchableOpacity>
        </View>

        {/* ── Delivery address ── */}
        <View style={[cardS.row, { marginTop: 10, alignItems: 'flex-start' }]}>
            <Ionicons name="location" size={14} color={C.delivery} style={{ marginTop: 2 }} />
            <Text style={cardS.address} numberOfLines={2}>
                {order.deliveryAddress || 'No delivery address set'}
            </Text>
            {/* Edit only allowed before a box is assigned */}
            {!order.boxId ? (
                <TouchableOpacity style={cardS.editBtn} onPress={onEditDelivery} activeOpacity={0.75}>
                    <Ionicons name="pencil" size={12} color={C.primary} />
                    <Text style={cardS.editBtnText}>Edit</Text>
                </TouchableOpacity>
            ) : (
                <View style={cardS.lockedBadge}>
                    <Ionicons name="lock-closed" size={11} color={C.textMuted} />
                    <Text style={cardS.lockedText}>Locked</Text>
                </View>
            )}
        </View>

        {/* ── Route badge ── */}
        {routeReady && (
            <View style={cardS.routeBadge}>
                <Ionicons name="navigate" size={11} color={C.primary} />
                <Text style={cardS.routeText}>Best route calculated</Text>
            </View>
        )}
    </View>
);

// ─── Legend panel ─────────────────────────────────────────────────────────────

const LegendPanel: React.FC<{ items: LegendItem[]; bottom: number }> = ({ items, bottom }) => (
    <View style={[legS.container, { bottom }]}>
        {items.map(item => (
            <View key={item.label} style={legS.item}>
                <View style={[legS.dot, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon} size={9} color="#fff" />
                </View>
                <Text style={legS.label}>{item.label}</Text>
            </View>
        ))}
    </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

const MapScreen: React.FC = () => {
    const route  = useRoute();
    const insets = useSafeAreaInsets();
    const { order: initialOrder } = route.params as { order: Order };

    const [order, setOrder]                         = useState<Order>(initialOrder);
    const [isEditingDelivery, setIsEditingDelivery] = useState(false);
    const [fullScreen, setFullScreen]               = useState(false);

    const cameraRef  = useRef<MapboxGL.Camera>(null);
    const slideAnim  = useRef(new Animated.Value(0)).current; // 0 = normal, 1 = full-screen

    const [mapStyle, setMapStyle]         = useState<'streets' | 'outdoors'>('streets');
    const [storeConfig, setStoreConfig]   = useState<StoreConfig | null>(null);
    const [boxLocation, setBoxLocation]   = useState<LatLng | null>(null);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [routeCoords, setRouteCoords]   = useState<number[][] | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [initialised, setInitialised]   = useState(false);

    // ── Full-screen toggle ──

    const toggleFullScreen = () => {
        const next = !fullScreen;
        setFullScreen(next);
        Animated.spring(slideAnim, {
            toValue: next ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 55,
        }).start();
    };

    // ── Derived coords ──

    const storeCoords: LatLng | null =
        storeConfig?.latitude && storeConfig?.longitude
            ? { latitude: parseFloat(storeConfig.latitude), longitude: parseFloat(storeConfig.longitude) }
            : null;

    const deliveryCoords: LatLng | null =
        order.deliveryLatitude && order.deliveryLongitude
            ? { latitude: parseFloat(order.deliveryLatitude), longitude: parseFloat(order.deliveryLongitude) }
            : null;

    // ── Store config ──

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'storeConfig'));
                if (snap.exists()) setStoreConfig(snap.data() as StoreConfig);
            } catch (err) { console.error('Store config error:', err); }
        })();
    }, []);

    // ── User GPS ──

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        })();
    }, []);

    // ── Box realtime location ──

    useEffect(() => {
        if (!order.boxId) return;
        try {
            const unsub = listenToRecentLocation(order.boxId, (data: LocationData | null) => {
                if (data) setBoxLocation({ latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude) });
            });
            return () => unsub();
        } catch (err) { console.error('Box listener error:', err); }
    }, [order.boxId]);

    // ── Route ──

    const calculateRoute = useCallback(async () => {
        const pts: LatLng[] = [];
        if (storeCoords)    pts.push(storeCoords);
        if (boxLocation)    pts.push(boxLocation);
        if (deliveryCoords) pts.push(deliveryCoords);
        if (pts.length < 2) return;
        setLoadingRoute(true);
        setRouteCoords(await fetchRoute(pts));
        setLoadingRoute(false);
    }, [
        storeCoords?.latitude, storeCoords?.longitude,
        boxLocation?.latitude, boxLocation?.longitude,
        deliveryCoords?.latitude, deliveryCoords?.longitude,
    ]);

    useEffect(() => { calculateRoute(); }, [calculateRoute]);

    // ── Fit all on first load ──

    useEffect(() => {
        if (initialised) return;
        const pts = [storeCoords, boxLocation, deliveryCoords].filter(Boolean) as LatLng[];
        if (!pts.length || !cameraRef.current) return;
        const lngs = pts.map(p => p.longitude);
        const lats  = pts.map(p => p.latitude);
        cameraRef.current.fitBounds(
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
            80, 600,
        );
        setInitialised(true);
    }, [storeCoords, boxLocation, deliveryCoords]);

    // ── Camera helpers ──

    const centerOnBox = () => {
        if (!boxLocation || !cameraRef.current) return;
        cameraRef.current.setCamera({
            centerCoordinate: [boxLocation.longitude, boxLocation.latitude],
            zoomLevel: 15, animationDuration: 500,
        });
    };

    const fitAll = () => {
        const pts = [storeCoords, boxLocation, deliveryCoords].filter(Boolean) as LatLng[];
        if (!pts.length || !cameraRef.current) return;
        const lngs = pts.map(p => p.longitude);
        const lats  = pts.map(p => p.latitude);
        cameraRef.current.fitBounds(
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
            80, 600,
        );
    };

    // ── Edit delivery ──

    const handleDeliveryEdit = async (picked: PickedLocation) => {
        setIsEditingDelivery(false);
        try {
            await updateDoc(doc(db, 'orders', order.orderId), {
                deliveryAddress:   picked.address,
                deliveryLatitude:  String(picked.latitude),
                deliveryLongitude: String(picked.longitude),
            });
            setOrder(prev => ({
                ...prev,
                deliveryAddress:   picked.address,
                deliveryLatitude:  String(picked.latitude),
                deliveryLongitude: String(picked.longitude),
            }));
            cameraRef.current?.setCamera({
                centerCoordinate: [picked.longitude, picked.latitude],
                zoomLevel: 15, animationDuration: 600,
            });
        } catch (err) { console.error('Failed to update delivery:', err); }
    };

    // ── Legend ──

    const legendItems: LegendItem[] = [
        ...(storeCoords    ? [{ color: C.store,    label: 'Store',    icon: 'storefront' as const }] : []),
        ...(boxLocation    ? [{ color: C.box,      label: 'Box',      icon: 'cube'       as const }] : []),
        ...(deliveryCoords ? [{ color: C.delivery,  label: 'Delivery', icon: 'location'   as const }] : []),
        ...(userLocation   ? [{ color: C.user,      label: 'You',      icon: 'person'     as const }] : []),
    ];

    // ── Route GeoJSON ──

    const routeGeoJSON: GeoJSON.FeatureCollection | null = routeCoords
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords }, properties: {} }] }
        : null;

    const center = boxLocation ?? storeCoords ?? DEFAULT_CENTER;

    // ── Animated values ──
    // Card slides down so that only CARD_PEEK_HEIGHT + bottom-inset is visible
    const cardSlideY = slideAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, SCREEN_H * 0.52],  // enough to push most of the card off-screen
    });

    const fabBottom     = fullScreen ? CARD_PEEK_HEIGHT + insets.bottom + 16 : 220;
    const legendBottom  = fullScreen ? CARD_PEEK_HEIGHT + insets.bottom + 16 : 220;

    return (
        <View style={s.root}>
            {/* ── Map fills 100% of screen ── */}
            <MapboxGL.MapView
                style={StyleSheet.absoluteFill}
                styleURL={mapStyle === 'outdoors' ? MapboxGL.StyleURL.SatelliteStreet : MapboxGL.StyleURL.Street}
                compassEnabled
                logoEnabled={false}
                attributionEnabled={false}
            >
                <MapboxGL.Camera
                    ref={cameraRef}
                    centerCoordinate={[center.longitude, center.latitude]}
                    zoomLevel={13}
                    animationMode="flyTo"
                    animationDuration={1000}
                />

                {routeGeoJSON && (
                    <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
                        <MapboxGL.LineLayer
                            id="routeCasing"
                            style={{ lineColor: '#fff', lineWidth: 8, lineOpacity: 0.35, lineCap: 'round', lineJoin: 'round' }}
                        />
                        <MapboxGL.LineLayer
                            id="routeLine"
                            style={{ lineColor: C.primary, lineWidth: 4, lineOpacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
                        />
                    </MapboxGL.ShapeSource>
                )}

                {storeCoords && (
                    <MarkerPin coordinate={[storeCoords.longitude, storeCoords.latitude]}
                               color={C.store} icon="storefront" label={storeConfig?.storeName ?? 'Store'} />
                )}
                {boxLocation && (
                    <MarkerPin coordinate={[boxLocation.longitude, boxLocation.latitude]}
                               color={C.box} icon="cube" label={`Box ${order.boxId}`} />
                )}
                {deliveryCoords && (
                    <MarkerPin coordinate={[deliveryCoords.longitude, deliveryCoords.latitude]}
                               color={C.delivery} icon="location" label="Delivery" />
                )}
                {userLocation && (
                    <MarkerPin coordinate={[userLocation.longitude, userLocation.latitude]}
                               color={C.user} icon="person" label="You" />
                )}
            </MapboxGL.MapView>

            {/* ── Route loading pill ── */}
            {loadingRoute && (
                <View style={[s.routeLoader, { top: insets.top + 12 }]}>
                    <ActivityIndicator size="small" color={C.primary} />
                    <Text style={s.routeLoaderText}>Calculating route…</Text>
                </View>
            )}

            {/* ── Exit full-screen hint (top-centre, only in full-screen mode) ── */}
            {fullScreen && (
                <TouchableOpacity
                    style={[s.exitHint, { top: insets.top + 12 }]}
                    onPress={toggleFullScreen}
                    activeOpacity={0.85}
                >
                    <Ionicons name="contract" size={14} color={C.primary} />
                    <Text style={s.exitHintText}>Exit full screen</Text>
                </TouchableOpacity>
            )}

            {/* ── Legend ── */}
            {legendItems.length > 0 && <LegendPanel items={legendItems} bottom={legendBottom} />}

            {/* ── FAB stack (right side) ── */}
            <View style={[s.fabStack, { bottom: fabBottom }]}>
                {/* ① Full-screen toggle — most prominent, always on top */}
                <TouchableOpacity style={[s.fab, s.fabAccent]} onPress={toggleFullScreen} activeOpacity={0.8}>
                    <Ionicons name={fullScreen ? 'contract' : 'expand'} size={20} color="#fff" />
                </TouchableOpacity>

                {/* ② Map style */}
                <TouchableOpacity
                    style={s.fab}
                    onPress={() => setMapStyle(m => m === 'streets' ? 'outdoors' : 'streets')}
                    activeOpacity={0.8}
                >
                    <Ionicons name={mapStyle === 'outdoors' ? 'map' : 'globe'} size={20} color={C.primary} />
                </TouchableOpacity>

                {/* ③ Fit all */}
                <TouchableOpacity style={s.fab} onPress={fitAll} activeOpacity={0.8}>
                    <Ionicons name="scan" size={20} color={C.primary} />
                </TouchableOpacity>

                {/* ④ Centre on box */}
                {boxLocation && (
                    <TouchableOpacity style={[s.fab, s.fabBox]} onPress={centerOnBox} activeOpacity={0.8}>
                        <Ionicons name="cube" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* ⑤ Recalculate route */}
                <TouchableOpacity style={s.fab} onPress={calculateRoute} disabled={loadingRoute} activeOpacity={0.8}>
                    <Ionicons name="navigate" size={20} color={C.primary} />
                </TouchableOpacity>
            </View>

            {/* ── Info card — slides down in full-screen mode leaving only CARD_PEEK_HEIGHT visible ── */}
            <Animated.View
                style={[
                    s.cardWrapper,
                    { paddingBottom: insets.bottom, transform: [{ translateY: cardSlideY }] },
                ]}
            >
                <InfoCard
                    order={order}
                    storeName={storeConfig?.storeName ?? ''}
                    routeReady={!!routeCoords}
                    fullScreen={fullScreen}
                    onEditDelivery={() => setIsEditingDelivery(true)}
                    onToggleFullScreen={toggleFullScreen}
                />
            </Animated.View>

            {/* ── Delivery location editor ── */}
            <DeliveryLocationPicker
                visible={isEditingDelivery}
                onConfirm={handleDeliveryEdit}
                onCancel={() => setIsEditingDelivery(false)}
            />
        </View>
    );
};

export default MapScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    routeLoader: {
        position: 'absolute', alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.surface,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20,
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12, shadowRadius: 6, elevation: 5,
    },
    routeLoaderText: { fontSize: 13, fontWeight: '600', color: C.text },

    exitHint: {
        position: 'absolute', alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.94)',
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20,
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12, shadowRadius: 6, elevation: 5,
    },
    exitHintText: { fontSize: 13, fontWeight: '600', color: C.primary },

    fabStack: {
        position: 'absolute', right: 16,
        gap: 10, alignItems: 'center',
    },
    fab: {
        width: 46, height: 46, borderRadius: 14,
        backgroundColor: C.surface,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
        borderWidth: 1, borderColor: C.border,
    },
    fabAccent: { backgroundColor: C.primary, borderColor: C.primary },
    fabBox:    { backgroundColor: C.box,     borderColor: C.box },

    cardWrapper: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
    },
});

const pinS = StyleSheet.create({
    container: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 2.5, backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
    },
    inner: {
        width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
});

const cardS = StyleSheet.create({
    card: {
        margin: 12,
        backgroundColor: C.surface,
        borderRadius: 16, padding: 14,
        shadowColor: C.shadow, shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 12,
        borderWidth: 1, borderColor: C.border,
    },
    // Bottom-sheet style when in full-screen mode
    cardSheet: {
        margin: 0,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        paddingTop: 8, paddingHorizontal: 16,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: C.border,
        alignSelf: 'center', marginBottom: 12,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    divider: { width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 14 },
    info: { flex: 1 },
    label: {
        fontSize: 10, fontWeight: '700', color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
    },
    value: { fontSize: 14, fontWeight: '700', color: C.text },
    address: {
        flex: 1, fontSize: 12, color: C.textMuted,
        marginLeft: 6, fontStyle: 'italic',
    },
    editBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8, borderWidth: 1.5, borderColor: C.primary,
        marginLeft: 8,
    },
    editBtnText: { fontSize: 11, fontWeight: '700', color: C.primary },
    lockedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8, borderWidth: 1.5, borderColor: C.border,
        marginLeft: 8, backgroundColor: C.bg,
    },
    lockedText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
    routeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        marginTop: 10, backgroundColor: '#EEF2FF',
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8, alignSelf: 'flex-start',
    },
    routeText: { fontSize: 11, fontWeight: '600', color: C.primary },
    fsBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center', alignItems: 'center',
    },
});

const legS = StyleSheet.create({
    container: {
        position: 'absolute', left: 16,
        flexDirection: 'column', gap: 6,
        backgroundColor: C.surface,
        borderRadius: 12, padding: 10,
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
        borderWidth: 1, borderColor: C.border,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: {
        width: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    label: { fontSize: 12, fontWeight: '600', color: C.text },
});