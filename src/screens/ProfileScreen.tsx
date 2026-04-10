import React, { useEffect, useState } from 'react';
import {
  ScrollView, Text, TouchableOpacity, View, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/authContext';
import { styles as globalStyles, COLORS } from '../styles/styles';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import InfoRow from '../components/InfoRow';
import StatusBadge from '../components/StatusBadge';
import SectionHeader from '../components/SectionHeader';
import { Order } from './OrdersScreen';

type OrderStats = { total: number; active: number; delivered: number };

function ProfileScreen() {
  const { logout, user, userRole } = useAuth();
  const [stats, setStats] = useState<OrderStats>({ total: 0, active: 0, delivered: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const q = userRole === 'Admin'
            ? query(collection(db, 'orders'))
            : query(collection(db, 'orders'), where('email', '==', user.email));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => d.data() as Order);
        setStats({
          total: all.length,
          active: all.filter(o => !o.delivered).length,
          delivered: all.filter(o => o.delivered).length,
        });
      } catch {
        // silently fail
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [user, userRole]);

  const handleLogout = () =>
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);

  const formatDate = (ts: number | undefined) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
      <ScrollView
          style={localStyles.container}
          contentContainerStyle={localStyles.content}
          showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar & Name ── */}
        <View style={localStyles.hero}>
          <View style={[localStyles.avatar, userRole === 'Admin' && localStyles.avatarAdmin]}>
            <Ionicons
                name={userRole === 'Admin' ? 'shield-checkmark' : 'person'}
                size={36}
                color={COLORS.primary}
            />
          </View>
          <Text style={localStyles.displayName} numberOfLines={1}>
            {user?.email?.split('@')[0] ?? 'User'}
          </Text>
          <Text style={localStyles.emailText}>{user?.email ?? '—'}</Text>
          <View style={localStyles.badgeRow}>
            <StatusBadge status={userRole === 'Admin' ? 'admin' : 'user'} showIcon />
            {user?.emailVerified && (
                <View style={localStyles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
                  <Text style={localStyles.verifiedText}>Verified</Text>
                </View>
            )}
          </View>
        </View>

        {/* ── Stats ── */}
        <SectionHeader title="Order Activity" />
        {loadingStats ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : (
            <View style={localStyles.statsRow}>
              <StatPill value={stats.total} label="Total" color={COLORS.primary} />
              <StatPill value={stats.active} label="Active" color="#f59e0b" />
              <StatPill value={stats.delivered} label="Delivered" color={COLORS.success} />
            </View>
        )}

        {/* ── Account Details ── */}
        <SectionHeader title="Account Details" />
        <View style={globalStyles.sectionContainer}>
          <InfoRow
              icon="mail-outline"
              label="Email"
              value={user?.email ?? '—'}
          />
          <InfoRow
              icon="shield-checkmark-outline"
              label="Role"
              value={userRole}
              valueColor={userRole === 'Admin' ? COLORS.primary : COLORS.textPrimary}
          />
          <InfoRow
              icon="checkmark-circle-outline"
              label="Email Verified"
              value={user?.emailVerified ? 'Yes' : 'No'}
              valueColor={user?.emailVerified ? COLORS.success : COLORS.error}
          />
          <InfoRow
              icon="calendar-outline"
              label="Member Since"
              value={formatDate(user?.metadata?.creationTime
                  ? new Date(user.metadata.creationTime).getTime()
                  : undefined)}
          />
          <InfoRow
              icon="time-outline"
              label="Last Sign In"
              value={formatDate(user?.metadata?.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).getTime()
                  : undefined)}
          />
          <InfoRow
              icon="finger-print-outline"
              label="User ID"
              value={user?.uid ?? '—'}
              last
          />
        </View>

        {/* ── Sign Out ── */}
        <SectionHeader title="Account" />
        <View style={globalStyles.sectionContainer}>
          <TouchableOpacity style={localStyles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
            <View style={localStyles.logoutIcon}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            </View>
            <Text style={localStyles.logoutText}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={localStyles.footer}>BoxTrack v1.0.0</Text>
      </ScrollView>
  );
}

const StatPill: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
    <View style={[localStyles.statPill, { borderTopColor: color }]}>
      <Text style={[localStyles.statValue, { color }]}>{value}</Text>
      <Text style={localStyles.statLabel}>{label}</Text>
    </View>
);

export default ProfileScreen;

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },

  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarAdmin: { borderColor: COLORS.primary },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  emailText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: COLORS.success },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 4,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logoutIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.error },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 24,
  },
});