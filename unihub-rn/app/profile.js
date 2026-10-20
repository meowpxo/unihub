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
import { getNotificationPrefs, setNotificationPref, clearNotifications } from '../constants/notifications';
import { Ionicons } from '@expo/vector-icons';

function SettingItem({ icon, iconColor, iconBg, label, sub, hasToggle, toggleVal, onToggle, danger, onPress }) {
  const ic = danger ? Colors.accent3 : (iconColor || Colors.accent);
  const bg = danger ? `${Colors.accent3}20` : (iconBg || `${ic}20`);
  return (
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.settingIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={19} color={ic} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, danger && { color: Colors.accent3 }]}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {hasToggle ? (
        <Switch
          value={toggleVal}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: ic }}
          thumbColor="white"
        />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
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
  const [gcal, setGcal]       = useState(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('unihub_token');
      if (!token) { setLoading(false); return; }

      const raw = await AsyncStorage.getItem('unihub_user');
      if (raw) setUser(JSON.parse(raw));

      const prefs = await getNotificationPrefs();
      setNotifs(prefs.deadlines);
      setClash(prefs.clash);

      const [dashData, gpaData] = await Promise.all([
        apiFetch('/schedule/dashboard'),
        apiFetch('/gpa/summary'),
      ]);
      setStats(dashData.stats);
      setCgpa(gpaData.cgpa);
      apiFetch('/google/status').then(setGcal).catch(() => setGcal(null));
    } catch (e) {
      console.warn('Profile load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggleNotifPref(name, value, setter) {
    setter(value);
    setNotificationPref(name, value).catch(e => console.warn('Notification pref error:', e.message));
  }

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
          await clearNotifications().catch(() => {});
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

        {/* AI Tools */}
        <Text style={styles.groupTitle}>AI Tools</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="sparkles" iconColor="#7b5ea7" label="Smart Study Planner" sub="AI schedule around your classes & deadlines"
            onPress={() => router.push('/study-planner')} />
        </View>

        {/* Integrations */}
        <Text style={styles.groupTitle}>Integrations</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="school" iconColor="#7b5ea7" label="Student Portal" sub="Connect & sync timetable, grades, assignments"
            onPress={() => router.push('/portal')} />
          <SettingItem icon="document-text" iconColor="#4f8ef7" label="PDF Schedule" sub="Upload academic calendar PDF"
            onPress={() => router.push('/pdf-upload')} />
          <SettingItem icon="calendar" iconColor="#38c9a0" label="Google Calendar"
            sub={gcal?.connected ? `Connected · ${gcal.google_email || 'Google account'}` : 'Not connected'}
            onPress={() => router.push('/google-calendar')} />
        </View>

        {/* Notifications */}
        <Text style={styles.groupTitle}>Notifications</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="notifications" iconColor="#f0a500" label="Deadline Reminders" sub="Push alerts for upcoming tasks"
            hasToggle toggleVal={notifs} onToggle={v => toggleNotifPref('deadlines', v, setNotifs)} />
          <SettingItem icon="flash" iconColor="#e8604c" label="Clash Alerts" sub="Warn when multiple deadlines clash"
            hasToggle toggleVal={clash} onToggle={v => toggleNotifPref('clash', v, setClash)} />
        </View>

        {/* Account */}
        <Text style={styles.groupTitle}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingItem icon="person" iconColor="#7b5ea7" label="Profile" sub={user?.email || ''} />
          <SettingItem icon="lock-closed" iconColor="#2dcfce" label="Change Password" sub="Update your password" />
          <SettingItem icon="log-out" label="Log Out" sub="Sign out of UniHub" danger onPress={handleLogout} />
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
  settingIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: Colors.text },
  settingSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  settingArrow: { fontSize: 20, color: Colors.muted },
});
