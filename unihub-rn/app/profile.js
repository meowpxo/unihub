import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

function SettingItem({ icon, label, sub, hasToggle, toggleVal, onToggle, danger, onPress }) {
  return (
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, danger && { color: Colors.accent3 }]}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {hasToggle ? (
        <Switch
          value={toggleVal}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: Colors.accent }}
          thumbColor="white"
        />
      ) : (
        <Text style={styles.settingArrow}>›</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const [user, setUser]       = useState(null);
  const [stats, setStats]     = useState({ upcomingDeadlines: 0, completedTasks: 0 });
  const [cgpa, setCgpa]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs]   = useState(true);
  const [clash, setClash]     = useState(true);
  const [calSync, setCalSync] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('unihub_token');
      if (!token) { setLoading(false); return; }

      const raw = await AsyncStorage.getItem('unihub_user');
      if (raw) setUser(JSON.parse(raw));

      const [dashData, gpaData] = await Promise.all([
        apiFetch('/schedule/dashboard'),
        apiFetch('/gpa/summary'),
      ]);
      setStats(dashData.stats);
      setCgpa(gpaData.cgpa);
    } catch (e) {
      console.warn('Profile load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
          await AsyncStorage.removeItem('unihub_token');
          await AsyncStorage.removeItem('unihub_user');
          router.replace('/login');
        },
      },
    ]);
  }

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).slice(0, 2).join('')
    : '?';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>

        {/* Profile Hero */}
        <View style={styles.profileHero}>
          <View style={styles.heroBanner} />
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
          <Text style={styles.profileId}>{user?.student_id || '—'}  ·  {user?.email || ''}</Text>
          <View style={styles.profileStats}>
            {[
              { val: cgpa !== null ? cgpa.toFixed(2) : '—', label: 'GPA',       color: Colors.accent },
              { val: String(stats.completedTasks),           label: 'Tasks Done', color: Colors.accent4 },
              { val: String(stats.upcomingDeadlines),        label: 'Due Soon',   color: Colors.warn },
            ].map((s, i) => (
              <View key={i} style={[styles.pstat, i < 2 && styles.pstatBorder]}>
                <Text style={[styles.pstatVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.pstatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Integrations */}
        <Text style={styles.groupTitle}>Integrations</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="📄" label="PDF Schedule" sub="Upload academic calendar PDF"
            onPress={() => router.push('/pdf-upload')} />
          <SettingItem icon="🗓" label="Google Calendar" sub={calSync ? 'Synced' : 'Not connected'}
            hasToggle toggleVal={calSync} onToggle={() => setCalSync(v => !v)} />
        </View>

        {/* Notifications */}
        <Text style={styles.groupTitle}>Notifications</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="🔔" label="Deadline Reminders" sub="Push alerts for upcoming tasks"
            hasToggle toggleVal={notifs} onToggle={() => setNotifs(v => !v)} />
          <SettingItem icon="⚡" label="Clash Alerts" sub="Warn when multiple deadlines clash"
            hasToggle toggleVal={clash} onToggle={() => setClash(v => !v)} />
        </View>

        {/* Account */}
        <Text style={styles.groupTitle}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="👤" label="Profile" sub={user?.email || ''} />
          <SettingItem icon="🔒" label="Change Password" sub="Update your password" />
          <SettingItem icon="🚪" label="Log Out" sub="Sign out of UniHub" danger onPress={handleLogout} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileHero: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 24, marginBottom: 24, alignItems: 'center',
    overflow: 'hidden', paddingBottom: 20,
  },
  heroBanner: { height: 70, width: '100%', backgroundColor: Colors.accent2, opacity: 0.3 },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -36,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  profileAvatarText: { fontSize: 28, fontWeight: '800', color: 'white' },
  profileName: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 12 },
  profileId: { fontSize: 12, color: Colors.muted, marginTop: 4 },
  profileStats: { flexDirection: 'row', marginTop: 16, width: '100%' },
  pstat: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  pstatBorder: { borderRightWidth: 1, borderRightColor: Colors.border },
  pstatVal: { fontSize: 20, fontWeight: '800' },
  pstatLabel: { fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },

  groupTitle: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
    color: Colors.muted, fontWeight: '700', marginBottom: 10,
  },
  settingsGroup: { marginBottom: 24, gap: 8 },
  settingItem: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 14,
  },
  settingIcon: { fontSize: 20, width: 30, textAlign: 'center' },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: Colors.text },
  settingSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  settingArrow: { fontSize: 20, color: Colors.muted },
});
