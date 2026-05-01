import React, {useEffect, useState, useMemo} from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Keyboard, Platform
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {COLORS} from '../styles/styles';
import {SafeAreaView} from "react-native-safe-area-context";
import {filterImages, CloudinaryResource} from '../utils/imageFilterUtil';
import DateTimePicker from '@react-native-community/datetimepicker';

const CLOUD_NAME = 'dr1nuiyin';
const TAG = 'box_tracking';

const ImageCard = ({item, onPress}: { item: CloudinaryResource; onPress: (url: string) => void }) => {
    const [isImageLoading, setIsImageLoading] = useState(true);
    const thumbnailUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_400,h_400,q_auto,f_auto/v${item.version}/${item.public_id}.${item.format}`;
    const fullSizeUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/v${item.version}/${item.public_id}.${item.format}`;
    const filename = item.public_id.split('/').pop() || 'Unknown Image';

    const displayDate = item.created_at
        ? new Date(item.created_at).toLocaleDateString()
        : '';

    return (
        <TouchableOpacity style={localStyles.cardContainer} activeOpacity={0.8} onPress={() => onPress(fullSizeUrl)}>
            <View style={localStyles.imageWrapper}>
                {isImageLoading && (
                    <View style={localStyles.imageLoader}>
                        <ActivityIndicator size="small" color={COLORS.primary}/>
                    </View>
                )}
                <Image
                    source={{uri: thumbnailUrl}}
                    style={localStyles.image}
                    resizeMode="cover"
                    onLoadEnd={() => setIsImageLoading(false)}
                />
            </View>
            <View style={localStyles.nameWrapper}>
                <Text style={localStyles.imageName} numberOfLines={1} ellipsizeMode="middle">{filename}</Text>
                {displayDate ? <Text style={localStyles.dateText}>{displayDate}</Text> : null}
            </View>
        </TouchableOpacity>
    );
};

function OrderImagesScreen() {
    const [images, setImages] = useState<CloudinaryResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    // --- 2. New Date Picker State ---
    const [showPicker, setShowPicker] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async (isRefreshing = false) => {
        if (isRefreshing) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const timestamp = Date.now();
            const url = `https://res.cloudinary.com/${CLOUD_NAME}/image/list/v${timestamp}/${TAG}.json`;
            const response = await fetch(url);

            if (!response.ok) throw new Error('Failed to fetch images. Check Cloudinary settings.');

            const data = await response.json();
            setImages(data.resources);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filteredImages = useMemo(() => {
        return filterImages(images, searchQuery, startDate, endDate);
    }, [images, searchQuery, startDate, endDate]);

    // --- 3. Date Picker Handlers ---
    const openPicker = (target: 'start' | 'end') => {
        setPickerTarget(target);
        setShowPicker(true);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        // Android fires this event instantly when a user presses OK or Cancel.
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (event.type === 'set' && selectedDate) {
            if (pickerTarget === 'start') {
                // Force time to 00:00:00.000 (Start of the day)
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                setStartDate(startOfDay);
            } else {
                // Force time to 23:59:59.999 (End of the day)
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);
                setEndDate(endOfDay);
            }
        } else if (event.type === 'dismissed') {
            setShowPicker(false);
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={localStyles.center}>
                <ActivityIndicator size="large" color={COLORS.primary}/>
            </View>
        );
    }

    return (
        <View style={localStyles.container}>
            <View style={localStyles.headerContainer}>

                <View style={localStyles.searchRow}>
                    <View style={localStyles.searchBar}>
                        <Ionicons name="search" size={20} color={COLORS.textMuted} style={localStyles.searchIcon}/>
                        <TextInput
                            style={localStyles.searchInput}
                            placeholder="Search image name..."
                            placeholderTextColor={COLORS.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />
                    </View>

                    <TouchableOpacity
                        style={[localStyles.filterButton, showFilters && localStyles.filterButtonActive]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowFilters(!showFilters);
                        }}
                    >
                        <Ionicons
                            name="options"
                            size={24}
                            color={showFilters ? '#FFFFFF' : COLORS.primary}
                        />
                    </TouchableOpacity>
                </View>

                {showFilters && (
                    <View style={localStyles.dateFilterContainer}>
                        <View style={localStyles.dateButtonsRow}>
                            {/* 4. Attach openPicker to the buttons */}
                            <TouchableOpacity style={localStyles.dateButton} onPress={() => openPicker('start')}>
                                <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted}/>
                                <Text style={localStyles.dateButtonText}>
                                    {startDate ? startDate.toLocaleDateString() : 'Start Date'}
                                </Text>
                            </TouchableOpacity>

                            <Text style={localStyles.dateSeparator}>to</Text>

                            <TouchableOpacity style={localStyles.dateButton} onPress={() => openPicker('end')}>
                                <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted}/>
                                <Text style={localStyles.dateButtonText}>
                                    {endDate ? endDate.toLocaleDateString() : 'End Date'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {(startDate || endDate || searchQuery !== '') && (
                            <TouchableOpacity
                                style={localStyles.clearButton}
                                onPress={() => {
                                    setStartDate(null);
                                    setEndDate(null);
                                    setSearchQuery('');
                                }}
                            >
                                <Text style={localStyles.clearButtonText}>Clear Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* 5. Render the actual Date Picker conditionally */}
            {showPicker && (
                <DateTimePicker
                    value={
                        pickerTarget === 'start'
                            ? (startDate || new Date())
                            : (endDate || new Date())
                    }
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    // Prevent picking an end date before the start date
                    minimumDate={pickerTarget === 'end' && startDate ? startDate : undefined}
                />
            )}

            <FlatList
                data={filteredImages}
                keyExtractor={(item) => item.public_id}
                renderItem={({item}) => <ImageCard item={item} onPress={setSelectedImageUrl}/>}
                numColumns={2}
                contentContainerStyle={localStyles.listContent}
                ListEmptyComponent={
                    !loading && !error ? <Text style={localStyles.emptyText}>No images match your search.</Text> : null
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => fetchImages(true)}
                                    colors={[COLORS.primary]} tintColor={COLORS.primary}/>
                }
                onScrollBeginDrag={Keyboard.dismiss}
                keyboardShouldPersistTaps="handled"
            />

            <Modal visible={!!selectedImageUrl} transparent={true} animationType="fade"
                   onRequestClose={() => setSelectedImageUrl(null)}>
                <SafeAreaView style={localStyles.modalContainer}>
                    <TouchableOpacity style={localStyles.closeButton} onPress={() => setSelectedImageUrl(null)}>
                        <Ionicons name="close-circle" size={36} color="#FFFFFF"/>
                    </TouchableOpacity>
                    {selectedImageUrl && (
                        <Image source={{uri: selectedImageUrl}} style={localStyles.fullScreenImage}
                               resizeMode="contain"/>
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
}

export default OrderImagesScreen;

const localStyles = StyleSheet.create({
    container: {flex: 1, backgroundColor: COLORS.background},
    center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
    listContent: {padding: 8},
    cardContainer: {
        flex: 1, margin: 8, backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.border, elevation: 2
    },
    imageWrapper: {
        height: 150,
        width: '100%',
        backgroundColor: '#E1E9EE',
        justifyContent: 'center',
        alignItems: 'center'
    },
    imageLoader: {...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1},
    image: {width: '100%', height: '100%', zIndex: 2},
    nameWrapper: {padding: 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border},
    imageName: {fontSize: 12, color: COLORS.textPrimary, textAlign: 'center', fontWeight: '500'},
    dateText: {fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 2},
    emptyText: {textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 16},

    headerContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    searchIcon: {marginRight: 8},
    searchInput: {flex: 1, fontSize: 16, color: COLORS.textPrimary, height: '100%'},

    filterButton: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },

    dateFilterContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    dateButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
    },
    dateButtonText: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    dateSeparator: {
        marginHorizontal: 12,
        fontSize: 14,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    clearButton: {
        marginTop: 12,
        paddingVertical: 8,
        alignItems: 'center',
    },
    clearButtonText: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '600',
    },

    modalContainer: {flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center'},
    closeButton: {position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10},
    fullScreenImage: {width: '100%', height: '90%'}
});