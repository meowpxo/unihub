import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

const SLOT_COLORS = [Colors.accent, Colors.accent2, Colors.teal ?? '#4ecdc4', Colors.warn, Colors.accent3, Colors.accent4];
const SLOT_TYPES  = ['lecture', 'lab', 'tutorial', 'fyp', 'break', 'other'];
const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}

export default function ScheduleScreen() {
  const today = new Date();
  const [activeDay, setActiveDay] = useState(2);
  const [slots, setSlots]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    course_name: '', course_code: '', day_of_week: today.getDay(),
    start_time: '', end_time: '', venue: '', lecturer: '',
    slot_type: 'lecture', color_index: 0,
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2 + i);
    return { letter: DAY_LABELS[d.getDay()].slice(0, 1), num: d.getDate(), dow: d.getDay() };
  });

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/schedule/timetable?day=${days[activeDay].dow}`);
      setSlots(data.slots || []);
    } catch (e) {
      console.warn('Timetable fetch error:', e.message);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [activeDay]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.course_name.trim()) return Alert.alert('Required', 'Please enter a course name.');
    if (!form.start_time.trim() || !form.end_time.trim()) return Alert.alert('Required', 'Please enter start and end time (e.g. 08:00).');
    setSaving(true);
    try {
      await apiFetch('/schedule/timetable', {
        method: 'POST',
        body: JSON.stringify({ ...form, day_of_week: form.day_of_week }),
      });
      setShowModal(false);
      setForm(f => ({ ...f, course_name: '', course_code: '', start_time: '', end_time: '', venue: '', lecturer: '' }));
      fetchSlots();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    Alert.alert('Delete Slot', 'Remove this class from your timetable?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/schedule/timetable/${id}`, { method: 'DELETE' });
            fetchSlots();
          } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>

        <Text style={styles.title}>Schedule</Text>

        {/* Week Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, i === activeDay && styles.dayChipActive]}
              onPress={() => setActiveDay(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayLetter, i === activeDay && styles.dayLetterActive]}>{d.letter}</Text>
              <Text style={[styles.dayNum, i === activeDay && styles.dayNumActive]}>{d.num}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Timetable */}
        <View style={styles.timetable}>
          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          ) : slots.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No classes on {DAY_LABELS[days[activeDay].dow]}</Text>
              <Text style={styles.emptyHint}>Tap + to add a class</Text>
            </View>
          ) : (
            slots.map((s, i) => {
              const color = SLOT_COLORS[s.color_index % SLOT_COLORS.length];
              return (
                <TouchableOpacity key={s.id ?? i} style={styles.timeSlot}
                  onLongPress={() => handleDelete(s.id)} activeOpacity={0.8}>
                  <Text style={styles.timeLabel}>{fmt(s.start_time)}</Text>
                  <View style={[styles.classCard, { borderLeftColor: color }]}>
                    <Text style={styles.className}>{s.course_name}</Text>
                    <Text style={styles.classMeta}>
                      {[s.venue, s.lecturer].filter(Boolean).join(' · ') || ' '}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
                      <Text style={[styles.badgeText, { color }]}>
                        {s.slot_type?.toUpperCase()}
                        {s.course_code ? `  ·  ${s.course_code}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.endTime}>{fmt(s.start_time)} – {fmt(s.end_time)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Add Slot Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Class</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'course_name', label: 'Course Name *', placeholder: 'Data Structures & Algorithms' },
                { key: 'course_code', label: 'Course Code', placeholder: 'CSC3534' },
                { key: 'start_time', label: 'Start Time *', placeholder: '08:00' },
                { key: 'end_time',   label: 'End Time *',   placeholder: '10:00' },
                { key: 'venue',      label: 'Venue',        placeholder: 'DK3, Block B' },
                { key: 'lecturer',   label: 'Lecturer',     placeholder: 'Lect. Rahman' },
              ].map(f => (
                <View key={f.key} style={styles.mField}>
                  <Text style={styles.mLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.mInput}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.muted}
                    value={form[f.key]}
                    onChangeText={v => setField(f.key, v)}
                    autoCapitalize={f.key === 'course_code' ? 'characters' : 'words'}
                  />
                </View>
              ))}

              {/* Day selector */}
              <View style={styles.mField}>
                <Text style={styles.mLabel}>Day</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {DAY_LABELS.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayBtn, form.day_of_week === i && styles.dayBtnActive]}
                      onPress={() => setField('day_of_week', i)}
                    >
                      <Text style={[styles.dayBtnText, form.day_of_week === i && styles.dayBtnTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Type selector */}
              <View style={styles.mField}>
                <Text style={styles.mLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {SLOT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.dayBtn, form.slot_type === t && styles.dayBtnActive]}
                      onPress={() => setField('slot_type', t)}
                    >
                      <Text style={[styles.dayBtnText, form.slot_type === t && styles.dayBtnTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}
              >
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Add Class</Text>}
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
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, padding: 22, paddingBottom: 16 },

  weekStrip: { paddingHorizontal: 22, gap: 8, paddingBottom: 8 },
  dayChip: {
    alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, minWidth: 52,
  },
  dayChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayLetter: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.muted },
  dayLetterActive: { color: 'rgba(255,255,255,0.75)' },
  dayNum: { fontSize: 18, fontWeight: '800', color: Colors.text },
  dayNumActive: { color: 'white' },

  timetable: { padding: 22, gap: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: Colors.muted },

  timeSlot: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  timeLabel: { fontSize: 11, color: Colors.muted, width: 44, paddingTop: 14 },
  classCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 16, padding: 14, borderLeftWidth: 3,
  },
  className: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  classMeta: { fontSize: 12, color: Colors.muted },
  badge: {
    alignSelf: 'flex-start', marginTop: 8,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  endTime: { fontSize: 11, color: Colors.muted, marginTop: 4 },

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
    padding: 24, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalClose: { fontSize: 18, color: Colors.muted, padding: 4 },

  mField: { marginBottom: 16 },
  mLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  mInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: Colors.text,
  },

  dayBtn: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  dayBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayBtnText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  dayBtnTextActive: { color: 'white' },

  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 8,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
