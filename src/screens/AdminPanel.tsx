import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, ActivityIndicator, Alert,
    TouchableOpacity, StyleSheet, RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { styles as globalStyles, COLORS } from '../styles/styles';
import { useAuth } from '../context/authContext';
import { Ionicons } from '@expo/vector-icons';
import SectionHeader from '../components/SectionHeader';
import SettingRow from '../components/SettingRow';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import MyButton from '../components/MyButton';
import * as Location from 'expo-location';

type UserData = { id: string; email?: string; role: string };
type Tab = 'users' | 'settings';

type StoreConfig = {
    storeName: string;
    address: string;
    latitude: string;
    longitude: string;
    contactEmail: string;
    phone: string;
};

const DEFAULT_STORE: StoreConfig = {
    storeName: '',
    address: '',
    latitude: '',
    longitude: '',
    contactEmail: '',
    phone: '',
};

// ─── Access Denied ────────────────────────────────────────────────────────────
const AccessDenied = () => (
    <View style={globalStyles.container}>
        <Ionicons name="lock-closed" size={48} color={COLORS.textMuted} style={{ marginBottom: 16, alignSelf: 'center' }} />
        <Text style={globalStyles.title}>Access Denied</Text>
        <Text style={globalStyles.subtitle}>You don't have permission to view this page.</Text>
    </View>
);

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
const TabBar: React.FC<{ active: Tab; onChange: (t: Tab) => void }> = ({ active, onChange }) => (
    <View style={tabStyles.container}>
        {(['users', 'settings'] as Tab[]).map(t => (
            <TouchableOpacity
                key={t}
                style={[tabStyles.tab, active === t && tabStyles.activeTab]}
                onPress={() => onChange(t)}
            >
                <Ionicons
                    name={t === 'users' ? 'people' : 'settings'}
                    size={16}
                    color={active === t ? COLORS.primary : COLORS.textMuted}
                    style={{ marginRight: 6 }}
                />
                <Text style={[tabStyles.label, active === t && tabStyles.activeLabel]}>
                    {t === 'users' ? 'Users' : 'Settings'}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
);

// ─── Users Tab ────────────────────────────────────────────────────────────────
const UsersTab: React.FC<{ currentUid: string | undefined }> = ({ currentUid }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const snap = await getDocs(collection(db, 'users'));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));
        } catch {
            Alert.alert('Error', 'Could not load users.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const toggleRole = (userId: string, currentRole: string) => {
        const newRole = currentRole === 'Admin' ? 'User' : 'Admin';
        Alert.alert(
            'Change Role',
            `Make this user a ${newRole}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            setUpdatingId(userId);
                            await updateDoc(doc(db, 'users', userId), { role: newRole });
                            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
                        } catch {
                            Alert.alert('Error', 'Failed to update role.');
                        } finally {
                            setUpdatingId(null);
                        }
                    },
                },
            ]
        );
    };

    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />;

    return (
        <FlatList
            data={users}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUsers} />}
            ListHeaderComponent={
                <SectionHeader
                    title="All Users"
                    subtitle={`${users.length} registered accounts`}
                    actionLabel="Refresh"
                    onAction={fetchUsers}
                />
            }
            ListEmptyComponent={
                <EmptyState icon="people-outline" title="No users found" />
            }
            renderItem={({ item }) => {
                const isSelf = currentUid === item.id;
                const isAdmin = item.role === 'Admin';
                return (
                    <View style={userStyles.card}>
                        {/* Avatar + Info */}
                        <View style={userStyles.row}>
                            <View style={[userStyles.avatar, { backgroundColor: isAdmin ? COLORS.primaryLight : COLORS.border }]}>
                                <Ionicons
                                    name={isAdmin ? 'shield-checkmark' : 'person'}
                                    size={20}
                                    color={isAdmin ? COLORS.primary : COLORS.textSecondary}
                                />
                            </View>
                            <View style={userStyles.info}>
                                <Text style={userStyles.email} numberOfLines={1}>
                                    {item.email ?? 'No email'}
                                    {isSelf && <Text style={userStyles.you}> (you)</Text>}
                                </Text>
                                <Text style={userStyles.uid} numberOfLines={1} ellipsizeMode="middle">
                                    {item.id}
                                </Text>
                            </View>
                            <StatusBadge status={isAdmin ? 'admin' : 'user'} showIcon />
                        </View>

                        {/* Action */}
                        {!isSelf && (
                            <View style={userStyles.footer}>
                                {updatingId === item.id ? (
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                ) : (
                                    <TouchableOpacity
                                        style={[
                                            userStyles.roleBtn,
                                            { backgroundColor: isAdmin ? COLORS.surface : COLORS.primary,
                                                borderColor: COLORS.primary, borderWidth: isAdmin ? 1.5 : 0 },
                                        ]}
                                        onPress={() => toggleRole(item.id, item.role ?? 'User')}
                                    >
                                        <Ionicons
                                            name={isAdmin ? 'person-outline' : 'shield-checkmark-outline'}
                                            size={13}
                                            color={isAdmin ? COLORS.primary : '#fff'}
                                            style={{ marginRight: 5 }}
                                        />
                                        <Text style={[userStyles.roleBtnText, { color: isAdmin ? COLORS.primary : '#fff' }]}>
                                            {isAdmin ? 'Remove Admin' : 'Make Admin'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                );
            }}
        />
    );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────
const SettingsTab: React.FC = () => {
    const [store, setStore] = useState<StoreConfig>(DEFAULT_STORE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'storeConfig'));
                if (snap.exists()) setStore({ ...DEFAULT_STORE, ...(snap.data() as StoreConfig) });
            } catch { /* no config yet */ }
            setLoading(false);
        })();
    }, []);

    const saveConfig = async () => {
        try {
            setSaving(true);
            await setDoc(doc(db, 'settings', 'storeConfig'), store);
            Alert.alert('Saved', 'Store configuration has been updated.');
            setEditMode(false);
        } catch {
            Alert.alert('Error', 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const useCurrentLocation = async () => {
        try {
            setLocating(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            setStore(prev => ({
                ...prev,
                latitude: loc.coords.latitude.toFixed(6),
                longitude: loc.coords.longitude.toFixed(6),
            }));
            setEditMode(true);
        } catch {
            Alert.alert('Error', 'Could not get current location.');
        } finally {
            setLocating(false);
        }
    };

    const field = (
        key: keyof StoreConfig, label: string,
        icon: React.ComponentProps<typeof Ionicons>['name'],
        opts?: { placeholder?: string; keyboard?: 'default' | 'decimal-pad' | 'email-address' | 'phone-pad' }
    ) => (
        <View style={settingStyles.fieldGroup}>
            <Text style={settingStyles.fieldLabel}>
                <Ionicons name={icon} size={13} color={COLORS.textSecondary} />  {label}
            </Text>
            {editMode ? (
                <TextInput
                    style={settingStyles.fieldInput}
                    value={store[key]}
                    onChangeText={val => setStore(prev => ({ ...prev, [key]: val }))}
                    placeholder={opts?.placeholder ?? label}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={opts?.keyboard ?? 'default'}
                    autoCapitalize="none"
                />
            ) : (
                <Text style={settingStyles.fieldValue}>
                    {store[key] || <Text style={{ color: COLORS.textMuted }}>Not set</Text>}
                </Text>
            )}
        </View>
    );

    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />;

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* ── Store Info ── */}
            <SectionHeader title="Store Information" subtitle="Public-facing store details" />
            <View style={settingStyles.section}>
                {field('storeName', 'Store Name', 'storefront-outline')}
                {field('address', 'Address', 'map-outline')}
                {field('contactEmail', 'Contact Email', 'mail-outline', { keyboard: 'email-address' })}
                {field('phone', 'Phone Number', 'call-outline', { keyboard: 'phone-pad' })}
            </View>

            {/* ── Store Location ── */}
            <SectionHeader title="Store Location" subtitle="GPS coordinates for the home depot" />
            <View style={settingStyles.section}>
                {field('latitude', 'Latitude', 'navigate-outline', { keyboard: 'decimal-pad', placeholder: 'e.g. -1.698774' })}
                {field('longitude', 'Longitude', 'navigate-outline', { keyboard: 'decimal-pad', placeholder: 'e.g. 29.256043' })}

                <TouchableOpacity
                    style={settingStyles.locateBtn}
                    onPress={useCurrentLocation}
                    disabled={locating}
                >
                    {locating
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Ionicons name="locate" size={16} color={COLORS.primary} />}
                    <Text style={settingStyles.locateBtnText}>
                        {locating ? 'Getting location…' : 'Use Current Device Location'}
                    </Text>
                </TouchableOpacity>

                {store.latitude && store.longitude && (
                    <View style={settingStyles.coordsPreview}>
                        <Ionicons name="pin" size={14} color={COLORS.success} />
                        <Text style={settingStyles.coordsText}>
                            {store.latitude}, {store.longitude}
                        </Text>
                    </View>
                )}
            </View>

            {/* ── Actions ── */}
            <View style={settingStyles.btnRow}>
                {editMode ? (
                    <>
                        <View style={{ flex: 1 }}>
                            <MyButton title="Save Changes" handleSubmit={saveConfig} isLoading={saving} />
                        </View>
                        <TouchableOpacity
                            style={settingStyles.cancelBtn}
                            onPress={() => setEditMode(false)}
                        >
                            <Text style={settingStyles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity style={settingStyles.editBtn} onPress={() => setEditMode(true)}>
                            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                            <Text style={settingStyles.editBtnText}>Edit Settings</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* ── App Info ── */}
            <SectionHeader title="About" />
            <View style={settingStyles.section}>
                <SettingRow
                    icon="cube-outline"
                    iconColor={COLORS.primary}
                    label="App Name"
                    value="BoxTrack"
                    type="info"
                />
                <SettingRow
                    icon="code-slash-outline"
                    iconColor={COLORS.textSecondary}
                    label="Version"
                    value="1.0.0"
                    type="info"
                />
                <SettingRow
                    icon="server-outline"
                    iconColor={COLORS.textSecondary}
                    label="Database"
                    value="Firebase"
                    type="info"
                    last
                />
            </View>
        </ScrollView>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AdminPanelScreen: React.FC = () => {
    const { user, userRole } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('users');

    if (userRole !== 'Admin') return <AccessDenied />;

    return (
        <View style={localStyles.container}>
            <TabBar active={activeTab} onChange={setActiveTab} />
            {activeTab === 'users'
                ? <UsersTab currentUid={user?.uid} />
                : <SettingsTab />
            }
        </View>
    );
};

export default AdminPanelScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
});

const tabStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    activeTab: { backgroundColor: COLORS.primaryLight },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
    activeLabel: { color: COLORS.primary },
});

const userStyles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        marginHorizontal: 16,
        marginVertical: 5,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    info: { flex: 1, marginRight: 8 },
    email: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    you: { fontSize: 12, fontWeight: '400', color: COLORS.textMuted },
    uid: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    footer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 10,
        alignItems: 'flex-end',
    },
    roleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    roleBtnText: { fontSize: 13, fontWeight: '700' },
});

const settingStyles = StyleSheet.create({
    section: {
        backgroundColor: COLORS.surface,
        marginHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginBottom: 4,
    },
    fieldGroup: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    fieldInput: {
        backgroundColor: COLORS.background,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.borderFocus,
    },
    fieldValue: {
        fontSize: 15,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    locateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.primaryLight,
        marginTop: 4,
    },
    locateBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    coordsPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    coordsText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 10,
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: COLORS.surface,
    },
    editBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: COLORS.border,
        alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});