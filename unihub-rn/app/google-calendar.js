import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

// Where the backend's callback page sends the browser back to (exp://… in Expo Go).
const RETURN_URL = Linking.createURL('google-calendar');

function formatTime(ts) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function GoogleCalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState({ connected: false, configured: true });
  const [busy, setBusy]       = useState(false);
  const [syncing, setSyncing] = useState(false);

  const runSync = useCallback(async (quiet) => {
    setSyncing(true);
    try {
      const data = await apiFetch('/google/sync', { method: 'POST', timeoutMs: 60000 });
      if (!quiet) Alert.alert('Sync complete', data.message);
      else Alert.alert('Google Calendar connected', data.message);
    } catch (e) {
      Alert.alert('Sync failed', e.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Reloads status; right after connecting (never synced yet) it runs the first sync.
  const load = useCallback(async () => {
    try {
      let data = await apiFetch('/google/status');
      if (data.connected && !data.last_synced_at) {
        setStatus(data);
        await runSync(true);
        data = await apiFetch('/google/status');
      }
      setStatus(data);
    } catch (e) {
      console.warn('google status error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [runSync]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleConnect() {
    setBusy(true);
    try {
      const { url } = await apiFetch('/google/auth-url', {
        method: 'POST',
        body: JSON.stringify({ returnUrl: RETURN_URL }),
      });
      const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
      if (result.type === 'success' && /google=(cancelled|error)/.test(result.url)) {
        Alert.alert('Not connected', 'Google sign-in was cancelled or failed.');
      }
      await load();   // also covers the student switching back to the app by hand
    } catch (e) {
      Alert.alert('Could not connect', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    await runSync(false);
    await load();
  }

  function handleDisconnect() {
    Alert.alert('Disconnect Google Calendar', 'UniHub will stop updating your Google Calendar. The "UniHub" calendar stays in your Google account — you can delete it there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try { await apiFetch('/google/disconnect', { method: 'POST' }); } catch {}
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
        <Text style={styles.headerTitle}>Google Calendar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="calendar" size={26} color="white" /></View>
          <Text style={styles.heroTitle}>Google Calendar Sync</Text>
          <Text style={styles.heroSub}>
            Adds your classes, task deadlines and saved academic dates to a "UniHub" calendar in your Google account.
          </Text>
          <View style={[styles.statusChip, status.connected ? styles.chipOn : styles.chipOff]}>
            <Ionicons name={status.connected ? 'checkmark-circle' : 'ellipse-outline'} size={14}
              color={status.connected ? Colors.accent4 : Colors.muted} />
            <Text style={[styles.statusChipText, { color: status.connected ? Colors.accent4 : Colors.muted }]}>
              {status.connected ? `Connected · ${status.google_email || 'Google account'}` : 'Not connected'}
            </Text>
          </View>
          {status.connected ? (
            <Text style={styles.lastSync}>Last synced: {formatTime(status.last_synced_at)}</Text>
          ) : null}
        </View>

        {!status.configured ? (
          <View style={styles.infoBox}>
            <Ionicons name="construct" size={16} color={Colors.warn} />
            <Text style={styles.infoText}>
              Google Calendar isn't set up on the server yet. Add the Google client ID, secret and redirect URI to backend/.env and restart the backend.
            </Text>
          </View>
        ) : status.connected ? (
          /* ── Connected state ── */
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
              {syncing
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="sync" size={18} color="white" /><Text style={styles.primaryBtnText}>Sync Now</Text></>}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Updates Google Calendar with your latest timetable and open tasks. Finished or deleted tasks are removed.
            </Text>

            <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect} activeOpacity={0.8}>
              <Ionicons name="unlink" size={16} color={Colors.accent3} />
              <Text style={styles.dangerBtnText}>Disconnect Google Calendar</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── Connect ── */
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleConnect} disabled={busy} activeOpacity={0.8}>
              {busy
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="logo-google" size={18} color="white" /><Text style={styles.primaryBtnText}>Connect Google Calendar</Text></>}
            </TouchableOpacity>
            <Text style={styles.hint}>
              You'll sign in with Google in your browser, then come back here. UniHub can only see and change the calendar it creates — not your other calendars.
            </Text>
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
    width: 56, height: 56, borderRadius: 18, backgroundColor: '#38c9a0',
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
  lastSync: { fontSize: 12, color: Colors.muted, marginTop: 10 },

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

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.warn}12`, borderWidth: 1, borderColor: `${Colors.warn}33`,
    borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12.5, color: Colors.muted, lineHeight: 18 },
});
