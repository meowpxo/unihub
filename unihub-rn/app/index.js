import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

const PRI_COLOR  = { High: Colors.accent3, Med: Colors.warn, Low: Colors.accent4 };
const TYPE_COLOR = { assignment: Colors.accent, lab: Colors.accent2, fyp: Colors.accent3, study: Colors.accent4, quiz: Colors.warn, other: Colors.accent };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 👋';
  if (h < 18) return 'Good afternoon ☀️';
  return 'Good evening 🌙';
}

function StatCard({ icon, value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DeadlineItem({ item }) {
  const days      = item.days_left;
  const daysColor = days <= 3 ? Colors.accent3 : days <= 7 ? Colors.warn : Colors.accent4;
  const typeColor = TYPE_COLOR[item.task_type] || Colors.accent;
  return (
    <View style={styles.deadlineItem}>
      <View style={[styles.deadlineDot, { backgroundColor: typeColor }]} />
      <View style={styles.deadlineInfo}>
        <View style={styles.deadlineCourseRow}>
          <Text style={styles.deadlineCourse}>{item.course || item.course_code || 'Task'}</Text>
          {item.source === 'moodle' && (
            <View style={styles.moodleBadge}>
              <Text style={styles.moodleBadgeText}>Moodle</Text>
            </View>
          )}
        </View>
        <Text style={styles.deadlineTask} numberOfLines={1}>{item.title}</Text>
      </View>
      <View style={styles.deadlineRight}>
        <Text style={[styles.deadlineDate, { color: typeColor }]}>
          {item.due_date ? new Date(item.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
        </Text>
        <Text style={[styles.deadlineDays, { color: daysColor }]}>
          {days === 0 ? 'Today' : days === 1 ? '1d left' : `${days}d left`}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [user, setUser]             = useState(null);
  const [stats, setStats]           = useState({ upcomingDeadlines: 0, completedTasks: 0 });
  const [upcoming, setUpcoming]     = useState([]);
  const [workload, setWorkload]     = useState([]);
  const [clash, setClash]           = useState([]);
  const [gpa, setGpa]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [moodleStatus, setMoodleStatus] = useState(null); // { count, last_sync, isDummy }

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('unihub_token');
      if (!token) { setLoading(false); return; }

      const raw = await AsyncStorage.getItem('unihub_user');
      if (raw) setUser(JSON.parse(raw));

      const [dashData, clashData, gpaData, moodleData] = await Promise.all([
        apiFetch('/schedule/dashboard'),
        apiFetch('/schedule/clash'),
        apiFetch('/gpa/summary'),
        apiFetch('/moodle/status'),
      ]);

      setStats(dashData.stats);
      setUpcoming(dashData.upcoming || []);
      setWorkload(dashData.workload || []);
      setClash(clashData.clashes || []);
      setGpa(gpaData.cgpa);
      setMoodleStatus(moodleData);
    } catch (e) {
      console.warn('Dashboard load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  async function handleMoodleSync() {
    setSyncing(true);
    try {
      const data = await apiFetch('/moodle/sync', { method: 'POST' });
      const note = data.isDummy ? '\n(Demo data — connect Moodle API for live assignments)' : '';
      Alert.alert('Moodle Synced', `${data.new} new · ${data.updated} updated${note}`);
      load(); // refresh dashboard with new tasks
    } catch (e) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setSyncing(false);
    }
  }

  const firstClash   = clash[0];
  const maxWorkload  = Math.max(...workload.map(w => w.tasks), 1);
  const initials     = user?.name ? user.name.split(' ').map(p => p[0]).slice(0, 2).join('') : '?';
  const hasMoodle    = (moodleStatus?.count ?? 0) > 0;
  const lastSyncText = moodleStatus?.last_sync
    ? new Date(moodleStatus.last_sync).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) +
      ' · ' + new Date(moodleStatus.last_sync).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>{greeting()}</Text>
            <Text style={styles.greetingName}>
              {user?.name?.split(' ')[1] || user?.name || 'Student'}{' '}
              <Text style={{ color: Colors.accent }}>·</Text> UniHub
            </Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/profile')}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="📅" value={String(stats.upcomingDeadlines)} label="Deadlines"  color={Colors.accent} />
          <StatCard icon="✅" value={String(stats.completedTasks)}    label="Completed"  color={Colors.accent4} />
          <StatCard icon="📊" value={gpa !== null ? String(gpa) : '—'} label="Curr. GPA" color={Colors.accent2} />
        </View>

        {/* Moodle Sync Card */}
        {!hasMoodle ? (
          // Not yet synced — prompt the user
          <TouchableOpacity
            style={styles.moodlePrompt}
            onPress={handleMoodleSync} disabled={syncing} activeOpacity={0.8}
          >
            <View style={styles.moodlePromptLeft}>
              <Text style={styles.moodlePromptTitle}>Sync Moodle Assignments</Text>
              <Text style={styles.moodlePromptSub}>Pull your latest tasks & deadlines automatically</Text>
            </View>
            {syncing
              ? <ActivityIndicator color={Colors.accent2} size="small" />
              : <Text style={styles.moodlePromptArrow}>⟳</Text>
            }
          </TouchableOpacity>
        ) : (
          // Already synced — show status + re-sync button
          <View style={styles.moodleStatus}>
            <View style={styles.moodleStatusLeft}>
              <View style={[styles.moodleDot, { backgroundColor: moodleStatus.isDummy ? Colors.warn : Colors.accent4 }]} />
              <Text style={styles.moodleStatusText}>
                {moodleStatus.isDummy ? 'Demo' : 'Live'} · {moodleStatus.count} Moodle task{moodleStatus.count !== 1 ? 's' : ''}
                {lastSyncText ? ` · Synced ${lastSyncText}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.reSyncBtn, syncing && { opacity: 0.5 }]}
              onPress={handleMoodleSync} disabled={syncing} activeOpacity={0.8}
            >
              {syncing
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.reSyncText}>⟳</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Clash Alert (Module 8) */}
        {firstClash && (
          <View style={styles.alertCard}>
            <Text style={styles.alertIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                Clash Alert – {new Date(firstClash.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              <Text style={styles.alertSub}>
                {firstClash.count} deadlines on the same day.
              </Text>
              {firstClash.suggestion && (
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionIcon}>💡</Text>
                  <Text style={styles.suggestionText}>
                    Complete{firstClash.suggestion.course ? ` "${firstClash.suggestion.course}"` : ''}{' '}
                    <Text style={styles.suggestionTask}>"{firstClash.suggestion.title}"</Text>
                    {' '}by{' '}
                    <Text style={styles.suggestionDate}>
                      {new Date(firstClash.suggestion.target_date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </Text>
                    {' '}to reduce workload on clash day.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Upcoming Deadlines */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          <TouchableOpacity onPress={() => router.push('/tasks')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming deadlines. You are all clear!</Text>
        ) : (
          upcoming.map((d, i) => <DeadlineItem key={d.id ?? i} item={d} />)
        )}

        {/* Weekly Workload */}
        {workload.length > 0 && (
          <View style={styles.workloadCard}>
            <Text style={styles.workloadTitle}>⚖ Weekly Workload</Text>
            {workload.map((w, i) => (
              <View key={i} style={styles.wlRow}>
                <Text style={styles.wlLabel}>{w.label}</Text>
                <View style={styles.wlTrack}>
                  <View style={[styles.wlFill, {
                    width: `${(w.tasks / maxWorkload) * 100}%`,
                    backgroundColor: w.tasks >= 3 ? Colors.accent3 : w.tasks >= 2 ? Colors.warn : Colors.accent4,
                  }]} />
                </View>
                <Text style={[styles.wlCount, {
                  color: w.tasks >= 3 ? Colors.accent3 : w.tasks >= 2 ? Colors.warn : Colors.accent4,
                }]}>{w.tasks}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: Colors.muted, fontSize: 13, paddingVertical: 20, paddingHorizontal: 22 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 22, paddingBottom: 16,
  },
  greetingSub:  { fontSize: 13, color: Colors.muted, marginBottom: 4 },
  greetingName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  avatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: 'white' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 14, gap: 5,
  },
  statIcon:  { fontSize: 18 },
  statVal:   { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Moodle prompt (first sync)
  moodlePrompt: {
    marginHorizontal: 22, marginBottom: 14,
    backgroundColor: `${Colors.accent2}18`,
    borderWidth: 1.5, borderColor: `${Colors.accent2}55`,
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  moodlePromptLeft:  { flex: 1 },
  moodlePromptTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  moodlePromptSub:   { fontSize: 12, color: Colors.muted },
  moodlePromptArrow: { fontSize: 22, color: Colors.accent2, fontWeight: '700' },

  // Moodle status bar (after sync)
  moodleStatus: {
    marginHorizontal: 22, marginBottom: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  moodleStatusLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  moodleDot:        { width: 7, height: 7, borderRadius: 99 },
  moodleStatusText: { fontSize: 11, color: Colors.muted, flex: 1 },
  reSyncBtn: {
    backgroundColor: Colors.accent2, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  reSyncText: { color: 'white', fontSize: 14, fontWeight: '700' },

  alertCard: {
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: 'rgba(232,96,76,0.1)',
    borderWidth: 1, borderColor: 'rgba(232,96,76,0.35)',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  alertIcon:  { fontSize: 22 },
  alertTitle: { fontWeight: '700', fontSize: 14, color: '#ff7a6b', marginBottom: 3 },
  alertSub:   { fontSize: 12, color: Colors.muted, marginBottom: 6 },

  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 2 },
  suggestionIcon: { fontSize: 12, marginTop: 1 },
  suggestionText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 18 },
  suggestionTask: { fontWeight: '700', color: Colors.text },
  suggestionDate: { fontWeight: '700', color: Colors.accent4 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 22, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  seeAll:       { fontSize: 12, color: Colors.accent },

  deadlineItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 22, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: 'rgba(42,48,69,0.5)',
  },
  deadlineDot:       { width: 10, height: 10, borderRadius: 5 },
  deadlineInfo:      { flex: 1 },
  deadlineCourseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  deadlineCourse:    { fontSize: 11, color: Colors.muted },
  moodleBadge: {
    backgroundColor: `${Colors.accent2}22`, borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  moodleBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.accent2, textTransform: 'uppercase', letterSpacing: 0.5 },
  deadlineTask:    { fontSize: 14, fontWeight: '500', color: Colors.text },
  deadlineRight:   { alignItems: 'flex-end' },
  deadlineDate:    { fontSize: 12, fontWeight: '700' },
  deadlineDays:    { fontSize: 11, marginTop: 2 },

  workloadCard: {
    margin: 22, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, padding: 18,
  },
  workloadTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  wlRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  wlLabel:       { fontSize: 11, color: Colors.muted, width: 30, textAlign: 'right' },
  wlTrack: { flex: 1, height: 6, backgroundColor: '#2a3045', borderRadius: 99, overflow: 'hidden' },
  wlFill:        { height: 6, borderRadius: 99 },
  wlCount:       { fontSize: 11, fontWeight: '700', width: 16 },
});
