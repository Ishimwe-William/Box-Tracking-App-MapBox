/**
 * DeliveryLocationPicker.tsx
 *
 * Full-screen modal for picking a delivery location on a Mapbox map.
 * Features:
 *  - Search bar (Mapbox Geocoding API) with autocomplete results
 *  - Tap-to-pin on the map
 *  - Draggable pin with reverse-geocode label
 *  - Satellite / Streets toggle
 *  - "Use my location" shortcut
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapboxConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PickedLocation = {
    latitude: number;
    longitude: number;
    address: string;
};

type SearchResult = {
    id: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
};

type Props = {
    visible: boolean;
    onConfirm: (location: PickedLocation) => void;
    onCancel: () => void;
    /** Initial location to show when no GPS – defaults to Kigali */
    defaultCenter?: [number, number]; // [lng, lat]
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KIGALI: [number, number] = [29.256043, -1.698774];
const PRIMARY = '#4F46E5';
const SURFACE = '#FFFFFF';
const BG = '#F8FAFC';
const BORDER = '#E2E8F0';
const TEXT = '#1E293B';
const TEXT_MUTED = '#94A3B8';
const SUCCESS = '#10B981';

// ─── API helpers ──────────────────────────────────────────────────────────────

async function searchPlaces(query: string): Promise<SearchResult[]> {
    if (query.trim().length < 2) return [];
    try {
        const encoded = encodeURIComponent(query.trim());
        const url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
            `?access_token=${MAPBOX_ACCESS_TOKEN}&limit=6&types=address,place,neighborhood,locality,poi`;
        const res = await fetch(url);
        const json = await res.json();
        return (json.features ?? []) as SearchResult[];
    } catch {
        return [];
    }
}

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

// ─── Component ────────────────────────────────────────────────────────────────

const DeliveryLocationPicker: React.FC<Props> = ({
                                                     visible,
                                                     onConfirm,
                                                     onCancel,
                                                     defaultCenter = KIGALI,
                                                 }) => {
    const cameraRef = useRef<MapboxGL.Camera>(null);

    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
    const [pin, setPin] = useState<PickedLocation | null>(null);
    const [geocoding, setGeocoding] = useState(false);

    // Search
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset state each time the modal opens
    useEffect(() => {
        if (!visible) return;
        setPin(null);
        setSearchText('');
        setSearchResults([]);
        setShowResults(false);
        setMapStyle('streets');

        // Try to fly to user's GPS location
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                cameraRef.current?.setCamera({
                    centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
                    zoomLevel: 15,
                    animationDuration: 700,
                });
            } catch { /* use default */ }
        })();
    }, [visible]);

    // Debounced search
    const handleSearchChange = (text: string) => {
        setSearchText(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (text.trim().length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            const results = await searchPlaces(text);
            setSearchResults(results);
            setShowResults(results.length > 0);
            setSearching(false);
        }, 380);
    };

    const selectSearchResult = (result: SearchResult) => {
        const [lng, lat] = result.center;
        Keyboard.dismiss();
        setSearchText(result.place_name);
        setShowResults(false);
        setSearchResults([]);
        placePin(lat, lng, result.place_name);
        cameraRef.current?.setCamera({
            centerCoordinate: [lng, lat],
            zoomLevel: 16,
            animationDuration: 600,
        });
    };

    const placePin = useCallback(async (lat: number, lng: number, knownAddress?: string) => {
        setPin({ latitude: lat, longitude: lng, address: knownAddress ?? '…' });
        if (!knownAddress) {
            setGeocoding(true);
            const addr = await reverseGeocode(lat, lng);
            setPin({ latitude: lat, longitude: lng, address: addr });
            setGeocoding(false);
        }
    }, []);

    const handleMapPress = (e: any) => {
        Keyboard.dismiss();
        setShowResults(false);
        const [lng, lat] = e.geometry.coordinates as [number, number];
        placePin(lat, lng);
    };

    const handleDragEnd = (e: any) => {
        const [lng, lat] = e.geometry.coordinates as [number, number];
        placePin(lat, lng);
    };

    const handleUseMyLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = loc.coords;
            cameraRef.current?.setCamera({
                centerCoordinate: [longitude, latitude],
                zoomLevel: 16,
                animationDuration: 600,
            });
            placePin(latitude, longitude);
        } catch { /* silent */ }
    };

    const mapStyleURL =
        mapStyle === 'satellite' ? MapboxGL.StyleURL.SatelliteStreet : MapboxGL.StyleURL.Street;

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={s.container}>

                    {/* ── Header ── */}
                    <View style={s.header}>
                        <TouchableOpacity onPress={onCancel} style={s.closeBtn}>
                            <Ionicons name="close" size={20} color={TEXT} />
                        </TouchableOpacity>
                        <View style={s.headerCenter}>
                            <Text style={s.headerTitle}>Delivery Location</Text>
                            <Text style={s.headerSub}>Search or tap the map</Text>
                        </View>
                        {/* Satellite toggle in header */}
                        <TouchableOpacity
                            style={[s.styleToggle, mapStyle === 'satellite' && s.styleToggleActive]}
                            onPress={() => setMapStyle(m => m === 'streets' ? 'satellite' : 'streets')}
                        >
                            <Ionicons
                                name={mapStyle === 'satellite' ? 'map' : 'globe'}
                                size={16}
                                color={mapStyle === 'satellite' ? SURFACE : PRIMARY}
                            />
                            <Text style={[s.styleToggleText, mapStyle === 'satellite' && { color: SURFACE }]}>
                                {mapStyle === 'satellite' ? 'Streets' : 'Satellite'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── Search bar ── */}
                    <View style={s.searchWrapper}>
                        <View style={s.searchBar}>
                            {searching
                                ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
                                : <Ionicons name="search" size={16} color={TEXT_MUTED} style={{ marginRight: 8 }} />
                            }
                            <TextInput
                                style={s.searchInput}
                                placeholder="Search address or place…"
                                placeholderTextColor={TEXT_MUTED}
                                value={searchText}
                                onChangeText={handleSearchChange}
                                returnKeyType="search"
                                autoCorrect={false}
                                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity onPress={() => {
                                    setSearchText('');
                                    setSearchResults([]);
                                    setShowResults(false);
                                }}>
                                    <Ionicons name="close-circle" size={16} color={TEXT_MUTED} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Autocomplete results */}
                        {showResults && (
                            <View style={s.resultsContainer}>
                                <FlatList
                                    data={searchResults}
                                    keyExtractor={item => item.id}
                                    keyboardShouldPersistTaps="always"
                                    ItemSeparatorComponent={() => <View style={s.resultSeparator} />}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={s.resultItem}
                                            onPress={() => selectSearchResult(item)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="location-outline" size={14} color={PRIMARY} style={{ marginRight: 10, marginTop: 1 }} />
                                            <Text style={s.resultText} numberOfLines={2}>{item.place_name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                    </View>

                    {/* ── Map ── */}
                    <MapboxGL.MapView
                        style={s.map}
                        styleURL={mapStyleURL}
                        onPress={handleMapPress}
                        compassEnabled
                        logoEnabled={false}
                        attributionEnabled={false}
                    >
                        <MapboxGL.Camera
                            ref={cameraRef}
                            centerCoordinate={defaultCenter}
                            zoomLevel={13}
                            animationMode="flyTo"
                            animationDuration={700}
                        />

                        {pin && (
                            <MapboxGL.PointAnnotation
                                id="delivery-pin"
                                coordinate={[pin.longitude, pin.latitude]}
                                draggable
                                onDragEnd={handleDragEnd}
                            >
                                <View style={s.pinOuter}>
                                    <View style={s.pinInner}>
                                        <Ionicons name="location" size={18} color={SURFACE} />
                                    </View>
                                    <View style={s.pinTail} />
                                </View>
                                <MapboxGL.Callout title="Delivery here" />
                            </MapboxGL.PointAnnotation>
                        )}
                    </MapboxGL.MapView>

                    {/* ── "Use my location" FAB ── */}
                    <TouchableOpacity style={s.myLocationBtn} onPress={handleUseMyLocation} activeOpacity={0.8}>
                        <Ionicons name="navigate" size={18} color={PRIMARY} />
                    </TouchableOpacity>

                    {/* ── Tap hint (no pin yet) ── */}
                    {!pin && (
                        <View style={s.tapHint} pointerEvents="none">
                            <Ionicons name="finger-print" size={18} color={PRIMARY} />
                            <Text style={s.tapHintText}>Tap the map to drop your pin</Text>
                        </View>
                    )}

                    {/* ── Footer: address preview + confirm ── */}
                    {pin && (
                        <View style={s.footer}>
                            <View style={s.addressRow}>
                                {geocoding
                                    ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 10 }} />
                                    : <View style={s.addressIcon}>
                                        <Ionicons name="location" size={14} color={SURFACE} />
                                    </View>
                                }
                                <View style={{ flex: 1 }}>
                                    <Text style={s.addressLabel}>DELIVERY ADDRESS</Text>
                                    <Text style={s.addressText} numberOfLines={2}>
                                        {geocoding ? 'Resolving address…' : pin.address}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => { setPin(null); setSearchText(''); }}
                                    style={s.clearPin}
                                >
                                    <Ionicons name="refresh" size={14} color={TEXT_MUTED} />
                                </TouchableOpacity>
                            </View>

                            <Text style={s.dragHint}>Drag the pin to fine-tune the position</Text>

                            <TouchableOpacity
                                style={[s.confirmBtn, geocoding && s.confirmBtnDisabled]}
                                onPress={() => !geocoding && onConfirm(pin)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="checkmark-circle" size={18} color={SURFACE} style={{ marginRight: 8 }} />
                                <Text style={s.confirmBtnText}>Confirm & Place Order</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default DeliveryLocationPicker;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: Platform.OS === 'ios' ? 56 : 44,
        paddingBottom: 12,
        backgroundColor: SURFACE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        gap: 10,
    },
    closeBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: BG,
        justifyContent: 'center', alignItems: 'center',
    },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
    headerSub: { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },
    styleToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: PRIMARY,
        backgroundColor: SURFACE,
    },
    styleToggleActive: { backgroundColor: PRIMARY },
    styleToggleText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

    // Search
    searchWrapper: {
        zIndex: 99,
        backgroundColor: SURFACE,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BG,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: BORDER,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: TEXT,
        padding: 0,
    },
    resultsContainer: {
        position: 'absolute',
        top: 68,
        left: 14,
        right: 14,
        backgroundColor: SURFACE,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
        maxHeight: 260,
        zIndex: 100,
        overflow: 'hidden',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    resultSeparator: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },
    resultText: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 18 },

    // Map
    map: { flex: 1 },

    // My location FAB
    myLocationBtn: {
        position: 'absolute',
        right: 14,
        bottom: 200,
        width: 44, height: 44,
        borderRadius: 13,
        backgroundColor: SURFACE,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12, shadowRadius: 6,
        elevation: 5,
        borderWidth: 1, borderColor: BORDER,
    },

    // Tap hint
    tapHint: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.96)',
        paddingHorizontal: 18, paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8,
        elevation: 4,
    },
    tapHintText: { fontSize: 13, fontWeight: '600', color: TEXT },

    // Pin
    pinOuter: { alignItems: 'center' },
    pinInner: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: PRIMARY,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 6,
        elevation: 7,
        borderWidth: 3, borderColor: SURFACE,
    },
    pinTail: {
        width: 0, height: 0,
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: PRIMARY,
        marginTop: -1,
    },

    // Footer
    footer: {
        backgroundColor: SURFACE,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08, shadowRadius: 12,
        elevation: 12,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 4,
    },
    addressIcon: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: PRIMARY,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 2,
    },
    addressLabel: {
        fontSize: 10, fontWeight: '700',
        color: TEXT_MUTED, letterSpacing: 0.6,
        textTransform: 'uppercase', marginBottom: 3,
    },
    addressText: {
        fontSize: 14, fontWeight: '600',
        color: TEXT, lineHeight: 20,
    },
    clearPin: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: BG,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 2,
    },
    dragHint: { fontSize: 11, color: TEXT_MUTED, marginTop: 4, marginBottom: 14 },
    confirmBtn: {
        flexDirection: 'row',
        backgroundColor: PRIMARY,
        paddingVertical: 15, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    confirmBtnDisabled: { opacity: 0.55 },
    confirmBtnText: { color: SURFACE, fontSize: 16, fontWeight: '700' },
});