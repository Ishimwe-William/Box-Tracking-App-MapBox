import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    SafeAreaView, Platform, StatusBar,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Order } from './OrdersScreen';
import { listenToRecentLocation, LocationData } from '../utils/rtdbUtils';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapboxConfig';

// Initialise the SDK once (top of file, outside component)
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

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
    primary: '#4F46E5',
    store: '#10B981',
    delivery: '#F59E0B',
    box: '#EF4444',
    user: '#3B82F6',
    route: '#4F46E5',
    surface: '#FFFFFF',
    bg: '#F8FAFC',
    text: '#1E293B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    shadow: '#000',
};

const DEFAULT_CENTER: LatLng = { latitude: -1.698774, longitude: 29.256043 };

// ─── Mapbox Directions API ─────────────────────────────────────────────────────

async function fetchRoute(waypoints: LatLng[]): Promise<number[][] | null> {
    if (waypoints.length < 2) return null;
    try {
        const coords = waypoints
            .map(w => `${w.longitude},${w.latitude}`)
            .join(';');
        const url =
            `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
            `?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.routes && json.routes.length > 0) {
            return json.routes[0].geometry.coordinates as number[][];
        }
        return null;
    } catch (err) {
        console.error('Route fetch error:', err);
        return null;
    }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MarkerPin: React.FC<{
    coordinate: [number, number];
    color: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
}> = ({ coordinate, color, icon, label }) => (
    <MapboxGL.PointAnnotation id={label} coordinate={coordinate}>
        <View style={[pinStyles.container, { borderColor: color }]}>
            <View style={[pinStyles.inner, { backgroundColor: color }]}>
                <Ionicons name={icon} size={14} color="#fff" />
            </View>
        </View>
        <MapboxGL.Callout title={label} />
    </MapboxGL.PointAnnotation>
);

const InfoCard: React.FC<{ order: Order; storeName: string; routeReady: boolean }> = ({
                                                                                          order, storeName, routeReady,
                                                                                      }) => (
    <View style={cardStyles.card}>
        <View style={cardStyles.row}>
            <View style={[cardStyles.dot, { backgroundColor: COLORS.primary }]} />
            <View style={cardStyles.info}>
                <Text style={cardStyles.label}>Order</Text>
                <Text style={cardStyles.value} numberOfLines={1}>#{order.orderId?.slice(-10)}</Text>
            </View>
            <View style={cardStyles.divider} />
            <View style={cardStyles.info}>
                <Text style={cardStyles.label}>Store</Text>
                <Text style={cardStyles.value} numberOfLines={1}>{storeName || '—'}</Text>
            </View>
        </View>

        {order.deliveryAddress ? (
            <View style={[cardStyles.row, { marginTop: 8 }]}>
                <Ionicons name="location" size={13} color={COLORS.delivery} />
                <Text style={cardStyles.address} numberOfLines={2}>{order.deliveryAddress}</Text>
            </View>
        ) : null}

        {routeReady && (
            <View style={cardStyles.routeBadge}>
                <Ionicons name="navigate" size={11} color={COLORS.primary} />
                <Text style={cardStyles.routeText}>Best route calculated</Text>
            </View>
        )}
    </View>
);

const LegendRow: React.FC<{ items: LegendItem[] }> = ({ items }) => (
    <View style={legendStyles.container}>
        {items.map(item => (
            <View key={item.label} style={legendStyles.item}>
                <View style={[legendStyles.dot, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon} size={9} color="#fff" />
                </View>
                <Text style={legendStyles.label}>{item.label}</Text>
            </View>
        ))}
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const MapScreen: React.FC = () => {
    const route = useRoute();
    const { order } = route.params as { order: Order };

    const cameraRef = useRef<MapboxGL.Camera>(null);

    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>(
        'streets'
    );
    const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
    const [boxLocation, setBoxLocation] = useState<LatLng | null>(null);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [routeCoords, setRouteCoords] = useState<number[][] | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [initialised, setInitialised] = useState(false);

    // ── Derived coords ──

    const storeCoords: LatLng | null =
        storeConfig?.latitude && storeConfig?.longitude
            ? {
                latitude: parseFloat(storeConfig.latitude),
                longitude: parseFloat(storeConfig.longitude),
            }
            : null;

    const deliveryCoords: LatLng | null =
        order.deliveryLatitude && order.deliveryLongitude
            ? {
                latitude: parseFloat(order.deliveryLatitude),
                longitude: parseFloat(order.deliveryLongitude),
            }
            : null;

    // ── Load store config ──

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'storeConfig'));
                if (snap.exists()) setStoreConfig(snap.data() as StoreConfig);
            } catch (err) {
                console.error('Could not load store config:', err);
            }
        })();
    }, []);

    // ── User location ──

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
        })();
    }, []);

    // ── Box real-time location ──

    useEffect(() => {
        if (!order.boxId) return;
        try {
            const unsub = listenToRecentLocation(order.boxId, (data: LocationData | null) => {
                if (data) {
                    setBoxLocation({
                        latitude: parseFloat(data.latitude),
                        longitude: parseFloat(data.longitude),
                    });
                }
            });
            return () => unsub();
        } catch (err) {
            console.error('Box listener error:', err);
        }
    }, [order.boxId]);

    // ── Calculate route once we have store + delivery ──

    const calculateRoute = useCallback(async () => {
        const waypoints: LatLng[] = [];
        if (storeCoords) waypoints.push(storeCoords);
        if (boxLocation) waypoints.push(boxLocation);
        if (deliveryCoords) waypoints.push(deliveryCoords);

        if (waypoints.length < 2) return;

        setLoadingRoute(true);
        const coords = await fetchRoute(waypoints);
        setRouteCoords(coords);
        setLoadingRoute(false);
    }, [storeCoords?.latitude, storeCoords?.longitude, boxLocation?.latitude, boxLocation?.longitude, deliveryCoords?.latitude, deliveryCoords?.longitude]);

    useEffect(() => {
        calculateRoute();
    }, [calculateRoute]);

    // ── Camera: fit to bounds once on first load ──

    useEffect(() => {
        if (initialised) return;
        const points = [storeCoords, boxLocation, deliveryCoords].filter(Boolean) as LatLng[];
        if (points.length === 0 || !cameraRef.current) return;

        const lngs = points.map(p => p.longitude);
        const lats = points.map(p => p.latitude);

        cameraRef.current.fitBounds(
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
            80,
            600,
        );
        setInitialised(true);
    }, [storeCoords, boxLocation, deliveryCoords]);

    // ── Center helpers ──

    const centerOnBox = () => {
        if (!boxLocation || !cameraRef.current) return;
        cameraRef.current.setCamera({
            centerCoordinate: [boxLocation.longitude, boxLocation.latitude],
            zoomLevel: 15,
            animationDuration: 500,
        });
    };

    const fitAll = () => {
        const points = [storeCoords, boxLocation, deliveryCoords].filter(Boolean) as LatLng[];
        if (points.length === 0 || !cameraRef.current) return;
        const lngs = points.map(p => p.longitude);
        const lats = points.map(p => p.latitude);
        cameraRef.current.fitBounds(
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
            80,
            600,
        );
    };

    // ── Legend items (only show what we have) ──

    const legendItems: LegendItem[] = [
        ...(storeCoords ? [{ color: COLORS.store, label: 'Store', icon: 'storefront' as const }] : []),
        ...(boxLocation ? [{ color: COLORS.box, label: 'Box', icon: 'cube' as const }] : []),
        ...(deliveryCoords ? [{ color: COLORS.delivery, label: 'Delivery', icon: 'location' as const }] : []),
        ...(userLocation ? [{ color: COLORS.user, label: 'You', icon: 'person' as const }] : []),
    ];

    // ── Route GeoJSON ──

    const routeGeoJSON: GeoJSON.FeatureCollection | null = routeCoords
        ? {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: routeCoords },
                    properties: {},
                },
            ],
        }
        : null;

    const center = boxLocation ?? storeCoords ?? DEFAULT_CENTER;

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" />

            {/* ── Info card ── */}
            <InfoCard
                order={order}
                storeName={storeConfig?.storeName ?? ''}
                routeReady={!!routeCoords}
            />

            {/* ── Map ── */}
            <View style={styles.mapContainer}>
                <MapboxGL.MapView
                    style={styles.map}
                    styleURL={
                        mapStyle === 'satellite'
                            ? MapboxGL.StyleURL.Satellite
                            : MapboxGL.StyleURL.Street
                    }
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

                    {/* Route line */}
                    {routeGeoJSON && (
                        <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
                            <MapboxGL.LineLayer
                                id="routeLine"
                                style={{
                                    lineColor: COLORS.route,
                                    lineWidth: 4,
                                    lineOpacity: 0.85,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                            {/* Dashed casing for depth */}
                            <MapboxGL.LineLayer
                                id="routeCasing"
                                style={{
                                    lineColor: '#fff',
                                    lineWidth: 8,
                                    lineOpacity: 0.35,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                                belowLayerID="routeLine"
                            />
                        </MapboxGL.ShapeSource>
                    )}

                    {/* Store marker */}
                    {storeCoords && (
                        <MarkerPin
                            coordinate={[storeCoords.longitude, storeCoords.latitude]}
                            color={COLORS.store}
                            icon="storefront"
                            label={storeConfig?.storeName ?? 'Store'}
                        />
                    )}

                    {/* Box marker */}
                    {boxLocation && (
                        <MarkerPin
                            coordinate={[boxLocation.longitude, boxLocation.latitude]}
                            color={COLORS.box}
                            icon="cube"
                            label={`Box ${order.boxId}`}
                        />
                    )}

                    {/* Delivery address marker */}
                    {deliveryCoords && (
                        <MarkerPin
                            coordinate={[deliveryCoords.longitude, deliveryCoords.latitude]}
                            color={COLORS.delivery}
                            icon="location"
                            label="Delivery Address"
                        />
                    )}

                    {/* User location marker */}
                    {userLocation && (
                        <MarkerPin
                            coordinate={[userLocation.longitude, userLocation.latitude]}
                            color={COLORS.user}
                            icon="person"
                            label="You"
                        />
                    )}
                </MapboxGL.MapView>

                {/* Loading route indicator */}
                {loadingRoute && (
                    <View style={styles.routeLoader}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.routeLoaderText}>Calculating route…</Text>
                    </View>
                )}

                {/* Legend */}
                {legendItems.length > 0 && <LegendRow items={legendItems} />}

                {/* FAB buttons */}
                <View style={styles.fabStack}>
                    {/* Toggle map style */}
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => setMapStyle(s => s === 'streets' ? 'satellite' : 'streets')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={mapStyle === 'satellite' ? 'map' : 'globe'}
                            size={20}
                            color={COLORS.primary}
                        />
                    </TouchableOpacity>

                    {/* Fit all */}
                    <TouchableOpacity style={styles.fab} onPress={fitAll} activeOpacity={0.8}>
                        <Ionicons name="scan" size={20} color={COLORS.primary} />
                    </TouchableOpacity>

                    {/* Center on box */}
                    {boxLocation && (
                        <TouchableOpacity style={[styles.fab, styles.fabPrimary]} onPress={centerOnBox} activeOpacity={0.8}>
                            <Ionicons name="cube" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {/* Recalculate route */}
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={calculateRoute}
                        disabled={loadingRoute}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="navigate" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default MapScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    mapContainer: { flex: 1, position: 'relative' },
    map: { flex: 1 },

    routeLoader: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    routeLoaderText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },

    fabStack: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        gap: 10,
        alignItems: 'center',
    },
    fab: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    fabPrimary: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
});

const pinStyles = StyleSheet.create({
    container: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2.5,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    inner: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

const cardStyles = StyleSheet.create({
    card: {
        margin: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 14,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    divider: {
        width: 1,
        height: 28,
        backgroundColor: COLORS.border,
        marginHorizontal: 14,
    },
    info: { flex: 1 },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    value: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    address: {
        flex: 1,
        fontSize: 12,
        color: COLORS.textMuted,
        marginLeft: 6,
        fontStyle: 'italic',
    },
    routeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 10,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    routeText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.primary,
    },
});

const legendStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        flexDirection: 'column',
        gap: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 10,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
    },
});