import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';

const FILTERS       = ['All', 'assignment', 'lab', 'study', 'fyp', 'quiz', 'other'];
const FILTER_LABELS = { All: 'All', assignment: 'Assignment', lab: 'Lab', study: 'Study', fyp: 'FYP', quiz: 'Quiz', other: 'Other' };
const PRI_COLORS    = { High: Colors.accent3, Med: Colors.warn, Low: Colors.accent4 };
const TYPE_COLORS   = { assignment: Colors.accent, lab: Colors.accent2, study: Colors.accent4, fyp: Colors.accent3, quiz: Colors.warn, other: Colors.muted };
const PRIORITIES    = ['High', 'Med', 'Low'];
const TASK_TYPES    = ['assignment', 'lab', 'study', 'fyp', 'quiz', 'other'];

export default function TasksScreen() {
  const [filter, setFilter]         = useState('All');
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { count, last_sync, isDummy }

  const [form, setForm] = useState({
    title: '', course: '', course_code: '',
    task_type: 'assignment', priority: 'Med', due_date: '',
  });

  const load = useCallback(async () => {
    try {
      const params = filter !== 'All' ? `?type=${filter}` : '';
      const data = await apiFetch(`/tasks${params}`);
      setTasks(data.tasks || []);
    } catch (e) {
      console.warn('Tasks load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const data = await apiFetch('/moodle/status');
      setSyncStatus(data);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { load(); loadSyncStatus(); }, [load, loadSyncStatus]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  async function handleMoodleSync() {
    setSyncing(true);
    try {
      const data = await apiFetch('/moodle/sync', { method: 'POST' });
      setSyncStatus(s => ({ ...s, count: data.total, last_sync: new Date().toISOString(), isDummy: data.isDummy }));
      load();
      const note = data.isDummy ? '\n(Using demo data — connect Moodle API for live assignments)' : '';
      Alert.alert('Moodle Synced', `${data.new} new · ${data.updated} updated${note}`);
    } catch (e) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(id) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, is_done: t.is_done ? 0 : 1 } : t));
    try {
      await apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' });
    } catch (_) { load(); }
  }

  async function handleDelete(id, source) {
    const isMoodle = source === 'moodle';
    Alert.alert(
      'Delete Task',
      isMoodle
        ? 'This task is synced from Moodle. Deleting it locally will not affect Moodle. Continue?'
        : 'Remove this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
              setTasks(ts => ts.filter(t => t.id !== id));
            } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ]
    );
  }

  async function handleCreate() {
    if (!form.title.trim()) return Alert.alert('Required', 'Task title is required.');
    setSaving(true);
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title:       form.title.trim(),
          course:      form.course.trim() || null,
          course_code: form.course_code.trim() || null,
          task_type:   form.task_type,
          priority:    form.priority,
          due_date:    form.due_date.trim() || null,
        }),
      });
      setShowModal(false);
      setForm({ title: '', course: '', course_code: '', task_type: 'assignment', priority: 'Med', due_date: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function formatLastSync(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) +
      ' · ' + d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tasks</Text>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
            onPress={handleMoodleSync} disabled={syncing} activeOpacity={0.8}
          >
            {syncing
              ? <ActivityIndicator color="white" size="small" />
              : <><Ionicons name="refresh" size={15} color="white" /><Text style={[styles.syncBtnText, { marginLeft: 6 }]}>Sync Moodle</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Sync status bar */}
        {syncStatus?.last_sync && (
          <View style={styles.syncBar}>
            <View style={[styles.syncDot, { backgroundColor: syncStatus.isDummy ? Colors.warn : Colors.accent4 }]} />
            <Text style={styles.syncBarText}>
              {syncStatus.isDummy ? 'Demo mode' : 'Live'} · {syncStatus.count} Moodle task{syncStatus.count !== 1 ? 's' : ''} · Last sync {formatLastSync(syncStatus.last_sync)}
            </Text>
          </View>
        )}

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)} activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Task List */}
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: `${Colors.accent3}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="clipboard" size={34} color={Colors.accent3} />
            </View>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptyHint}>Sync Moodle or tap + to add tasks</Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {tasks.map(t => {
              const typeColor = TYPE_COLORS[t.task_type] || Colors.accent;
              const isMoodle  = t.source === 'moodle';
              return (
                <TouchableOpacity
                  key={t.id} style={styles.taskCard}
                  onLongPress={() => handleDelete(t.id, t.source)} activeOpacity={0.8}
                >
                  <TouchableOpacity
                    style={[styles.check, t.is_done && styles.checkDone]}
                    onPress={() => handleToggle(t.id)} activeOpacity={0.7}
                  >
                    {!!t.is_done && <Ionicons name="checkmark" size={14} color="white" />}
                  </TouchableOpacity>

                  <View style={styles.taskBody}>
                    <View style={styles.taskTitleRow}>
                      <Text style={[styles.taskTitle, t.is_done && styles.taskDone]} numberOfLines={2}>
                        {t.title}
                      </Text>
                      {isMoodle && (
                        <View style={styles.moodleBadge}>
                          <Text style={styles.moodleBadgeText}>Moodle</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.taskMeta}>
                      {t.course_code && (
                        <View style={[styles.courseTag, { backgroundColor: `${typeColor}22` }]}>
                          <Text style={[styles.courseTagText, { color: typeColor }]}>{t.course_code}</Text>
                        </View>
                      )}
                      {t.due_date && (
                        <Text style={styles.taskDue}>
                          Due {new Date(t.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </Text>
                      )}
                      <Text style={[styles.taskPri, { color: PRI_COLORS[t.priority] ?? Colors.muted }]}>
                        {t.priority}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={22} color={Colors.muted} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.mField}>
                <Text style={styles.mLabel}>Task Title *</Text>
                <TextInput style={styles.mInput} placeholder="e.g. Assignment 2 – Dynamic Programming"
                  placeholderTextColor={Colors.muted} value={form.title} onChangeText={v => setField('title', v)} />
              </View>

              <View style={styles.mRow}>
                <View style={[styles.mField, { flex: 1 }]}>
                  <Text style={styles.mLabel}>Course Name</Text>
                  <TextInput style={styles.mInput} placeholder="Algorithms" placeholderTextColor={Colors.muted}
                    value={form.course} onChangeText={v => setField('course', v)} />
                </View>
                <View style={{ width: 12 }} />
                <View style={[styles.mField, { flex: 1 }]}>
                  <Text style={styles.mLabel}>Course Code</Text>
                  <TextInput style={styles.mInput} placeholder="CSC3534" placeholderTextColor={Colors.muted}
                    autoCapitalize="characters" value={form.course_code} onChangeText={v => setField('course_code', v)} />
                </View>
              </View>

              <View style={styles.mField}>
                <Text style={styles.mLabel}>Due Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.mInput} placeholder="2026-05-30" placeholderTextColor={Colors.muted}
                  value={form.due_date} onChangeText={v => setField('due_date', v)} />
              </View>

              <View style={styles.mField}>
                <Text style={styles.mLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {TASK_TYPES.map(t => (
                    <TouchableOpacity key={t}
                      style={[styles.chip, form.task_type === t && styles.chipActive]}
                      onPress={() => setField('task_type', t)}
                    >
                      <Text style={[styles.chipText, form.task_type === t && styles.chipTextActive]}>
                        {FILTER_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.mField}>
                <Text style={styles.mLabel}>Priority</Text>
                <View style={styles.priRow}>
                  {PRIORITIES.map(p => (
                    <TouchableOpacity key={p}
                      style={[styles.priBtn, form.priority === p && { backgroundColor: PRI_COLORS[p], borderColor: PRI_COLORS[p] }]}
                      onPress={() => setField('priority', p)}
                    >
                      <Text style={[styles.priBtnText, form.priority === p && { color: 'white' }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Add Task</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.accent2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  syncBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  syncBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 22, marginBottom: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  syncDot:     { width: 7, height: 7, borderRadius: 99 },
  syncBarText: { fontSize: 11, color: Colors.muted, flex: 1 },

  filterRow: { paddingHorizontal: 22, gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 16, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText:       { fontSize: 12, fontWeight: '500', color: Colors.muted },
  filterTextActive: { color: 'white' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: Colors.muted },

  taskList: { paddingHorizontal: 22, gap: 10 },
  taskCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start',
  },
  check: {
    width: 22, height: 22, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkDone: { backgroundColor: Colors.accent4, borderColor: Colors.accent4 },
  checkMark: { color: Colors.bg, fontSize: 13, fontWeight: '800' },

  taskBody: { flex: 1 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  taskTitle:    { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
  taskDone:     { textDecorationLine: 'line-through', color: Colors.muted },

  moodleBadge: {
    backgroundColor: `${Colors.accent2}22`, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
  },
  moodleBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.accent2, textTransform: 'uppercase', letterSpacing: 0.5 },

  taskMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  courseTag:     { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  courseTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  taskDue:       { fontSize: 11, color: Colors.muted },
  taskPri:       { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 'auto' },

  fab: {
    position: 'absolute', bottom: 20, right: 24,
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  fabText: { color: 'white', fontSize: 28, fontWeight: '300', marginTop: -2 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:  { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalClose:  { fontSize: 18, color: Colors.muted, padding: 4 },

  mField: { marginBottom: 16 },
  mRow:   { flexDirection: 'row' },
  mLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  mInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: Colors.text,
  },

  chip:         { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  chipActive:   { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText:     { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: 'white' },

  priRow: { flexDirection: 'row', gap: 10 },
  priBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  priBtnText: { fontSize: 13, fontWeight: '700', color: Colors.muted },

  saveBtn:     { backgroundColor: Colors.accent, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
