import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { API_BASE_URL } from '../constants/Config';
import { apiFetch } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PdfUploadScreen() {
  const [file, setFile]             = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savingTT, setSavingTT]     = useState(false);
  const [result, setResult]         = useState(null);
  const [saved, setSaved]           = useState(false);
  const [savedTT, setSavedTT]       = useState(false);

  async function pickPDF() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      setFile(res.assets[0]);
      setResult(null);
      setSaved(false);
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  }

  async function uploadPDF() {
    if (!file) return;
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('unihub_token');
      const form  = new FormData();
      form.append('pdf', { uri: file.uri, name: file.name, type: 'application/pdf' });

      const res = await fetch(`${API_BASE_URL}/pdf/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setResult(data);
      setSaved(false);
      setSavedTT(false);
    } catch (err) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveToSchedule() {
    if (!result?.upload?.id) return;
    setSaving(true);
    try {
      const data = await apiFetch(`/pdf/${result.upload.id}/save-all`, { method: 'PATCH' });
      setSaved(true);
      Alert.alert('Saved!', data.message || `${result.events.length} events saved to your schedule.`);
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveTimetable() {
    if (!result?.timetableSlots?.length) return;
    setSavingTT(true);
    try {
      const data = await apiFetch('/schedule/timetable/bulk', {
        method: 'POST',
        body: JSON.stringify({ slots: result.timetableSlots }),
      });
      setSavedTT(true);
      Alert.alert('Saved!', data.message || `${result.timetableSlots.length} slots saved to your timetable.`);
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSavingTT(false);
    }
  }

  const events        = result?.events        ?? [];
  const timetableSlots = result?.timetableSlots ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>PDF Schedule Parser</Text>
        <Text style={styles.sub}>Upload your academic calendar PDF to extract key dates automatically.</Text>

        {/* Upload Zone */}
        <TouchableOpacity style={styles.uploadZone} onPress={pickPDF} activeOpacity={0.7}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: `${Colors.accent}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name={file ? 'document-text' : 'document-outline'} size={36} color={Colors.accent} />
          </View>
          {file
            ? <Text style={styles.uploadFileText}>{file.name}</Text>
            : <Text style={styles.uploadPrompt}>Tap to select PDF</Text>
          }
          <Text style={styles.uploadHint}>Academic calendar, timetable, exam schedule</Text>
        </TouchableOpacity>

        {file && (
          <TouchableOpacity
            style={[styles.parseBtn, uploading && styles.parseBtnDisabled]}
            onPress={uploadPDF} disabled={uploading} activeOpacity={0.85}
          >
            {uploading
              ? <><ActivityIndicator color="white" /><Text style={styles.parseBtnText}>  Parsing…</Text></>
              : <><Ionicons name="flash" size={18} color="white" /><Text style={[styles.parseBtnText, { marginLeft: 8 }]}>Parse Schedule</Text></>
            }
          </TouchableOpacity>
        )}

        {/* Results */}
        {result && (
          <View style={styles.resultsSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Extracted Events</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{events.length}</Text>
              </View>
            </View>
            <Text style={styles.pageInfo}>
              {result.upload?.pageCount ? `${result.upload.pageCount} pages parsed` : ''}
            </Text>

            {events.length === 0 && (
              <Text style={styles.noEvents}>No events found. Try a different PDF.</Text>
            )}

            {events.map((ev, i) => (
              <View key={i} style={[styles.eventCard, { borderLeftColor: typeColor(ev.type) }]}>
                <View style={styles.eventTop}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: `${typeColor(ev.type)}22` }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColor(ev.type) }]}>{ev.type}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.muted} />
                  <Text style={styles.eventDate}>{ev.date}</Text>
                </View>
                {ev.description && <Text style={styles.eventDesc}>{ev.description}</Text>}
              </View>
            ))}

            {events.length > 0 && (
              <TouchableOpacity
                style={[styles.saveBtn, (saving || saved) && { opacity: 0.7 }]}
                activeOpacity={0.8} onPress={saveToSchedule} disabled={saving || saved}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <><Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={18} color="white" /><Text style={[styles.saveBtnText, { marginLeft: 8 }]}>{saved ? 'Saved to Schedule' : 'Save to Schedule'}</Text></>
                }
              </TouchableOpacity>
            )}

            {/* Timetable Slots Section */}
            {timetableSlots.length > 0 && (
              <View style={styles.ttSection}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Timetable Slots</Text>
                  <View style={[styles.countBadge, { backgroundColor: Colors.accent2 }]}>
                    <Text style={styles.countBadgeText}>{timetableSlots.length}</Text>
                  </View>
                </View>
                <Text style={styles.pageInfo}>Classes detected from timetable</Text>

                {timetableSlots.map((s, i) => (
                  <View key={i} style={styles.ttCard}>
                    <View style={styles.ttLeft}>
                      <Text style={styles.ttDay}>{DAY_LABELS[s.day_of_week]}</Text>
                      <Text style={styles.ttTime}>{s.start_time}–{s.end_time}</Text>
                    </View>
                    <View style={styles.ttRight}>
                      <Text style={styles.ttName}>{s.course_name}</Text>
                      <Text style={styles.ttMeta}>
                        {[s.course_code, s.slot_type, s.venue, s.lecturer].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.saveTTBtn, (savingTT || savedTT) && { opacity: 0.7 }]}
                  activeOpacity={0.8} onPress={saveTimetable} disabled={savingTT || savedTT}
                >
                  {savingTT
                    ? <ActivityIndicator color="white" />
                    : <><Ionicons name={savedTT ? 'checkmark-circle' : 'calendar-outline'} size={18} color="white" /><Text style={[styles.saveBtnText, { marginLeft: 8 }]}>{savedTT ? 'Timetable Saved' : 'Save as Timetable'}</Text></>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function typeColor(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('exam'))                              return Colors.accent3;
  if (t.includes('holiday') || t.includes('break'))   return Colors.accent4;
  if (t.includes('registration'))                      return Colors.accent2;
  if (t.includes('deadline') || t.includes('submission')) return Colors.warn;
  return Colors.accent;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: 22, paddingBottom: 40 },

  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.muted, marginBottom: 24, lineHeight: 19 },

  uploadZone: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.accent,
    borderStyle: 'dashed', borderRadius: 20,
    padding: 32, alignItems: 'center', gap: 8, marginBottom: 16,
  },
  uploadIcon: { fontSize: 40 },
  uploadFileText: { fontSize: 15, fontWeight: '700', color: Colors.accent, textAlign: 'center' },
  uploadPrompt: { fontSize: 15, fontWeight: '700', color: Colors.muted },
  uploadHint: { fontSize: 11, color: Colors.muted, textAlign: 'center' },

  parseBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', marginBottom: 28,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  parseBtnDisabled: { opacity: 0.6 },
  parseBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  resultsSection: { gap: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  countBadge: { backgroundColor: Colors.accent, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  countBadgeText: { color: 'white', fontSize: 12, fontWeight: '800' },
  pageInfo: { fontSize: 11, color: Colors.muted, marginBottom: 8 },
  noEvents: { color: Colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  eventCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 14, gap: 6, borderLeftWidth: 3,
  },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  typeBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventDate: { fontSize: 12, color: Colors.muted },
  eventDesc: { fontSize: 12, color: Colors.muted, lineHeight: 17 },

  saveBtn: {
    backgroundColor: Colors.accent4, borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },

  ttSection: { marginTop: 8, gap: 10 },
  ttCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  ttLeft: {
    backgroundColor: `${Colors.accent2}22`, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', minWidth: 56,
  },
  ttDay:  { fontSize: 11, fontWeight: '800', color: Colors.accent2, textTransform: 'uppercase' },
  ttTime: { fontSize: 10, color: Colors.muted, marginTop: 2 },
  ttRight: { flex: 1 },
  ttName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  ttMeta: { fontSize: 11, color: Colors.muted, marginTop: 3 },
  saveTTBtn: {
    backgroundColor: Colors.accent2, borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
});
