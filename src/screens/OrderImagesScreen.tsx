import React, {useEffect, useState, useMemo} from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Keyboard, Platform, Alert
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {COLORS} from '../styles/styles';
import {SafeAreaView} from "react-native-safe-area-context";
import {filterImages, CloudinaryResource} from '../utils/imageFilterUtil';
import DateTimePicker from '@react-native-community/datetimepicker';
import PagerView from 'react-native-pager-view';
import {Directory, File, Paths} from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const CLOUD_NAME = 'dr1nuiyin';
const TAG = 'box_tracking';

// --- Shared Download Function (Cache Collision Fix) ---
const downloadImage = async (url: string, filename: string) => {
    try {
        // Request gallery permissions
        const {status} = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need permission to save images to your gallery.');
            return;
        }

        // 1. Create a UNIQUE temporary folder in the cache for this specific download
        // Using Date.now() ensures this folder name never repeats
        const tempDir = new Directory(Paths.cache, `download_${Date.now()}`);
        tempDir.create();

        // 2. Download the file directly into that guaranteed-empty folder
        const downloadedFile = await File.downloadFileAsync(url, tempDir);

        // 3. Save the resulting file URI to the phone's gallery
        await MediaLibrary.createAssetAsync(downloadedFile.uri);
        Alert.alert('Success', 'Image saved to your gallery!');

    } catch (error) {
        console.error('Download error:', error);
        Alert.alert('Error', 'Failed to save the image.');
    }
};

const ImageCard = ({item, onPress}: { item: CloudinaryResource; onPress: () => void }) => {
    const [isImageLoading, setIsImageLoading] = useState(true);

    const thumbnailUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_400,h_400,q_auto,f_auto/v${item.version}/${item.public_id}.${item.format}`;
    // Always download the full size/highest quality version
    const fullSizeUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/v${item.version}/${item.public_id}.${item.format}`;
    const filename = item.public_id.split('/').pop() || 'Unknown Image';

    const displayDate = item.created_at
        ? new Date(item.created_at).toLocaleDateString()
        : '';

    return (
        <TouchableOpacity style={localStyles.cardContainer} activeOpacity={0.8} onPress={onPress}>
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
                <View style={localStyles.nameTextColumn}>
                    <Text style={localStyles.imageName} numberOfLines={1} ellipsizeMode="middle">{filename}</Text>
                    {displayDate ? <Text style={localStyles.dateText}>{displayDate}</Text> : null}
                </View>
                {/* 2. Download Button on the Grid Card */}
                <TouchableOpacity
                    style={localStyles.cardDownloadBtn}
                    onPress={() => downloadImage(fullSizeUrl, `${filename}.${item.format}`)}
                >
                    <Ionicons name="download-outline" size={20} color={COLORS.primary}/>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

function OrderImagesScreen() {
    const [images, setImages] = useState<CloudinaryResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

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

    const openPicker = (target: 'start' | 'end') => {
        setPickerTarget(target);
        setShowPicker(true);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (event.type === 'set' && selectedDate) {
            if (pickerTarget === 'start') {
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                setStartDate(startOfDay);
            } else {
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

            {showPicker && (
                <DateTimePicker
                    value={pickerTarget === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={pickerTarget === 'end' && startDate ? startDate : undefined}
                />
            )}

            <FlatList
                data={filteredImages}
                keyExtractor={(item) => item.public_id}
                renderItem={({item, index}) => (
                    <ImageCard item={item} onPress={() => setSelectedIndex(index)}/>
                )}
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

            <Modal
                visible={selectedIndex !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedIndex(null)}
            >
                <SafeAreaView style={localStyles.modalContainer}>
                    {/* Top Controls: Close & Download */}
                    <View style={localStyles.modalHeaderRow}>
                        {selectedIndex !== null && filteredImages[selectedIndex] && (
                            <TouchableOpacity
                                style={localStyles.modalActionButton}
                                onPress={() => {
                                    const activeImg = filteredImages[selectedIndex];
                                    const fullSizeUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/v${activeImg.version}/${activeImg.public_id}.${activeImg.format}`;
                                    const filename = `${activeImg.public_id.split('/').pop()}.${activeImg.format}`;
                                    downloadImage(fullSizeUrl, filename);
                                }}
                            >
                                <Ionicons name="download" size={28} color="#FFFFFF"/>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={localStyles.modalActionButton} onPress={() => setSelectedIndex(null)}>
                            <Ionicons name="close-circle" size={32} color="#FFFFFF"/>
                        </TouchableOpacity>
                    </View>

                    {selectedIndex !== null && (
                        <PagerView
                            style={localStyles.pagerView}
                            initialPage={selectedIndex}
                            overdrag={true}
                            onPageSelected={(e) => setSelectedIndex(e.nativeEvent.position)} // Keep index synced when swiping
                        >
                            {filteredImages.map((img, idx) => {
                                const fullSizeUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/v${img.version}/${img.public_id}.${img.format}`;

                                return (
                                    <View key={img.public_id} style={localStyles.pageContainer}>
                                        <Image
                                            source={{uri: fullSizeUrl}}
                                            style={localStyles.fullScreenImage}
                                            resizeMode="contain"
                                        />
                                        <Text style={localStyles.imageCounter}>
                                            {idx + 1} of {filteredImages.length}
                                        </Text>
                                    </View>
                                );
                            })}
                        </PagerView>
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

    // --- Updated Card Name Wrapper to fit the icon ---
    nameWrapper: {
        padding: 8,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    nameTextColumn: {
        flex: 1,
        paddingRight: 4,
    },
    imageName: {fontSize: 12, color: COLORS.textPrimary, fontWeight: '500'},
    dateText: {fontSize: 10, color: COLORS.textMuted, marginTop: 2},
    cardDownloadBtn: {
        padding: 4,
    },

    emptyText: {textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 16},

    headerContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    searchRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: 10, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: COLORS.border
    },
    searchIcon: {marginRight: 8},
    searchInput: {flex: 1, fontSize: 16, color: COLORS.textPrimary, height: '100%'},

    filterButton: {
        width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    },
    filterButtonActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},

    dateFilterContainer: {marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border},
    dateButtonsRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    dateButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
        paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, gap: 6,
    },
    dateButtonText: {fontSize: 14, color: COLORS.textPrimary, fontWeight: '500'},
    dateSeparator: {marginHorizontal: 12, fontSize: 14, color: COLORS.textMuted, fontWeight: '500'},
    clearButton: {marginTop: 12, paddingVertical: 8, alignItems: 'center'},
    clearButtonText: {color: COLORS.error, fontSize: 14, fontWeight: '600'},

    // --- Updated Modal Styles ---
    modalContainer: {flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)'},
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 24,
        zIndex: 10,
    },
    modalActionButton: {
        padding: 8,
    },
    pagerView: {flex: 1, width: '100%'},
    pageContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
    fullScreenImage: {width: '100%', height: '85%'},
    imageCounter: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        position: 'absolute',
        bottom: 40
    }
});