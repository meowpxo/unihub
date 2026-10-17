import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

export default function PortalScreen() {
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState({ connected: false });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [syncing, setSyncing]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/portal-link/status');
      setStatus(data);
    } catch (e) {
      console.warn('portal status error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleConnect() {
    if (!username.trim() || !password) {
      Alert.alert('Missing details', 'Enter your portal ID and password.');
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch('/portal-link/connect', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setPassword('');
      Alert.alert('Connected', `Linked to portal account ${data.portal_student?.student_id || ''}.`);
      await load();
    } catch (e) {
      Alert.alert('Could not connect', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const data = await apiFetch('/portal-link/sync', { method: 'POST' });
      Alert.alert('Sync complete', data.message || 'Your portal data is up to date.');
      await load();
    } catch (e) {
      Alert.alert('Sync failed', e.message);
      if (/reconnect|not connected|expired/i.test(e.message)) load();
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    Alert.alert('Disconnect portal', 'Your synced classes and grades will stay, but new syncs will stop until you reconnect.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try { await apiFetch('/portal-link/disconnect', { method: 'POST' }); } catch {}
          await load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Portal</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="school" size={26} color="white" /></View>
          <Text style={styles.heroTitle}>UniHub VLE Portal</Text>
          <Text style={styles.heroSub}>
            Link your student portal to pull your timetable, grades and assignments straight into UniHub.
          </Text>
          <View style={[styles.statusChip, status.connected ? styles.chipOn : styles.chipOff]}>
            <Ionicons name={status.connected ? 'checkmark-circle' : 'ellipse-outline'} size={14}
              color={status.connected ? Colors.accent4 : Colors.muted} />
            <Text style={[styles.statusChipText, { color: status.connected ? Colors.accent4 : Colors.muted }]}>
              {status.connected ? `Connected · ${status.portal_username}` : 'Not connected'}
            </Text>
          </View>
        </View>

        {status.connected ? (
          /* ── Connected state ── */
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
              {syncing
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="sync" size={18} color="white" /><Text style={styles.primaryBtnText}>Sync Now</Text></>}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Pulls the latest classes, grades and assignments from the portal and updates your app.
            </Text>

            <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect} activeOpacity={0.8}>
              <Ionicons name="unlink" size={16} color={Colors.accent3} />
              <Text style={styles.dangerBtnText}>Disconnect portal account</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── Connect form ── */
          <>
            <Text style={styles.label}>Portal Student ID</Text>
            <TextInput
              style={styles.input} value={username} onChangeText={setUsername}
              placeholder="e.g. 12345678" placeholderTextColor={Colors.muted}
              autoCapitalize="none" autoCorrect={false}
            />
            <Text style={styles.label}>Portal Password</Text>
            <TextInput
              style={styles.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={Colors.muted} secureTextEntry
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleConnect} disabled={busy} activeOpacity={0.8}>
              {busy
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="link" size={18} color="white" /><Text style={styles.primaryBtnText}>Connect Portal</Text></>}
            </TouchableOpacity>

            <View style={styles.demoBox}>
              <Ionicons name="information-circle" size={16} color={Colors.accent} />
              <Text style={styles.demoText}>
                Demo portal account — ID <Text style={styles.demoBold}>12345678</Text>, password <Text style={styles.demoBold}>demo123</Text>
              </Text>
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  hero: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 24,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 14, borderWidth: 1,
  },
  chipOn: { backgroundColor: `${Colors.accent4}18`, borderColor: `${Colors.accent4}55` },
  chipOff: { backgroundColor: 'transparent', borderColor: Colors.border },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  label: { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, marginTop: 4,
  },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 17 },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: `${Colors.accent3}55`, borderRadius: 14, paddingVertical: 13, marginTop: 22,
  },
  dangerBtnText: { color: Colors.accent3, fontSize: 14, fontWeight: '700' },

  demoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.accent}12`, borderWidth: 1, borderColor: `${Colors.accent}33`,
    borderRadius: 12, padding: 12, marginTop: 20,
  },
  demoText: { flex: 1, fontSize: 12.5, color: Colors.muted, lineHeight: 18 },
  demoBold: { fontWeight: '800', color: Colors.accent },
});
