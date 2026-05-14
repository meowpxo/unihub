import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

const COURSE_COLORS = [Colors.accent, Colors.accent2, Colors.teal ?? '#4ecdc4', Colors.warn, Colors.accent3, Colors.accent4];

const GRADE_COLOR = {
  A: Colors.accent4, 'A-': Colors.accent4,
  'B+': Colors.accent2, B: Colors.accent2, 'B-': Colors.accent2,
  'C+': Colors.warn, C: Colors.warn,
  D: Colors.accent3, F: Colors.accent3,
};

export default function GPAScreen() {
  const [courses, setCourses]   = useState([]);
  const [cgpa, setCgpa]         = useState(null);
  const [totalCH, setTotalCH]   = useState(0);
  const [loading, setLoading]   = useState(true);

  // Modal state
  const [showCourseModal, setShowCourseModal]   = useState(false);
  const [showAssessModal, setShowAssessModal]   = useState(false);
  const [expandedId, setExpandedId]             = useState(null);
  const [saving, setSaving]                     = useState(false);
  const [selectedCourse, setSelectedCourse]     = useState(null);

  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', credit_hours: '3', semester: '' });
  const [assessForm, setAssessForm] = useState({ name: '', weight: '', score: '', max_score: '100' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('unihub_token');
      if (!token) { setLoading(false); return; }
      const data = await apiFetch('/gpa/summary');
      setCourses(data.courses || []);
      setCgpa(data.cgpa);
      setTotalCH(data.totalCreditHours || 0);
    } catch (e) {
      console.warn('GPA load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAddCourse() {
    if (!courseForm.course_name.trim()) return Alert.alert('Required', 'Course name is required.');
    setSaving(true);
    try {
      await apiFetch('/gpa/courses', {
        method: 'POST',
        body: JSON.stringify({
          course_code:  courseForm.course_code.trim(),
          course_name:  courseForm.course_name.trim(),
          credit_hours: parseInt(courseForm.credit_hours) || 3,
          semester:     courseForm.semester.trim(),
        }),
      });
      setShowCourseModal(false);
      setCourseForm({ course_code: '', course_name: '', credit_hours: '3', semester: '' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteCourse(id) {
    Alert.alert('Delete Course', 'Remove this course and all its marks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/gpa/courses/${id}`, { method: 'DELETE' });
            load();
          } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  async function handleAddAssessment() {
    if (!assessForm.name.trim() || !assessForm.weight) return Alert.alert('Required', 'Name and weight are required.');
    setSaving(true);
    try {
      await apiFetch(`/gpa/courses/${selectedCourse.id}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          name:      assessForm.name.trim(),
          weight:    parseFloat(assessForm.weight),
          score:     assessForm.score !== '' ? parseFloat(assessForm.score) : null,
          max_score: parseFloat(assessForm.max_score) || 100,
        }),
      });
      setShowAssessModal(false);
      setAssessForm({ name: '', weight: '', score: '', max_score: '100' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteAssessment(id) {
    try {
      await apiFetch(`/gpa/assessments/${id}`, { method: 'DELETE' });
      load();
    } catch (e) { Alert.alert('Error', e.message); }
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <Text style={styles.title}>GPA Tracker</Text>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Current Cumulative GPA</Text>
          <Text style={styles.heroValue}>{cgpa !== null ? cgpa.toFixed(2) : '—'}</Text>
          <Text style={styles.heroSub}>{totalCH} credit hours tracked</Text>
          <View style={styles.heroRow}>
            {[
              { label: 'Courses', val: String(courses.length) },
              { label: 'Credits', val: String(totalCH) },
              { label: 'Status',  val: cgpa === null ? 'No data' : cgpa >= 3.5 ? 'Dean\'s List' : cgpa >= 3.0 ? 'Good' : cgpa >= 2.0 ? 'Pass' : 'At Risk' },
            ].map((item, i) => (
              <View key={i} style={styles.heroMini}>
                <Text style={styles.heroMiniLabel}>{item.label}</Text>
                <Text style={styles.heroMiniVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Courses</Text>
          <TouchableOpacity onPress={() => setShowCourseModal(true)}>
            <Text style={styles.addBtn}>+ Add Course</Text>
          </TouchableOpacity>
        </View>

        {courses.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No courses yet</Text>
            <Text style={styles.emptyHint}>Tap "+ Add Course" to start tracking your GPA</Text>
          </View>
        )}

        {/* Course Cards */}
        <View style={styles.courseList}>
          {courses.map((c, i) => {
            const color    = COURSE_COLORS[i % COURSE_COLORS.length];
            const gradeClr = GRADE_COLOR[c.grade] || Colors.muted;
            const expanded = expandedId === c.id;
            return (
              <View key={c.id} style={styles.courseCard}>
                <TouchableOpacity style={styles.courseTop} onPress={() => setExpandedId(expanded ? null : c.id)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{c.course_name}</Text>
                    <Text style={styles.courseCode}>{c.course_code}  ·  {c.credit_hours} CH  {c.semester ? `·  ${c.semester}` : ''}</Text>
                  </View>
                  <Text style={[styles.courseGrade, { color: gradeClr }]}>{c.grade || '—'}</Text>
                </TouchableOpacity>

                {c.totalPct !== null && (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(c.totalPct, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.progressPct}>{c.totalPct.toFixed(1)}%  ·  GP {c.gradePoint?.toFixed(2)}</Text>
                  </>
                )}

                {/* Expanded: assessments */}
                {expanded && (
                  <View style={styles.assessSection}>
                    <View style={styles.assessHeader}>
                      <Text style={styles.assessTitle}>Assessments</Text>
                      <TouchableOpacity onPress={() => { setSelectedCourse(c); setShowAssessModal(true); }}>
                        <Text style={styles.addBtn}>+ Add Mark</Text>
                      </TouchableOpacity>
                    </View>
                    {c.assessments?.length === 0 && (
                      <Text style={styles.noAssess}>No marks added yet</Text>
                    )}
                    {c.assessments?.map(a => (
                      <View key={a.id} style={styles.assessRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.assessName}>{a.name}</Text>
                          <Text style={styles.assessWeight}>Weight: {a.weight}%</Text>
                        </View>
                        <Text style={styles.assessScore}>
                          {a.score !== null ? `${a.score}/${a.max_score}` : '—'}
                        </Text>
                        <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteAssessment(a.id)}>
                          <Text style={styles.delBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={styles.deleteCourseBtn} onPress={() => handleDeleteCourse(c.id)}>
                      <Text style={styles.deleteCourseBtnText}>Delete Course</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* Add Course Modal */}
      <Modal visible={showCourseModal} animationType="slide" transparent onRequestClose={() => setShowCourseModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Course</Text>
              <TouchableOpacity onPress={() => setShowCourseModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {[
              { key: 'course_name', label: 'Course Name *', placeholder: 'Data Structures & Algorithms' },
              { key: 'course_code', label: 'Course Code *', placeholder: 'CSC3534' },
              { key: 'credit_hours', label: 'Credit Hours', placeholder: '3', keyboardType: 'numeric' },
              { key: 'semester', label: 'Semester', placeholder: 'March 2026' },
            ].map(f => (
              <View key={f.key} style={styles.mField}>
                <Text style={styles.mLabel}>{f.label}</Text>
                <TextInput
                  style={styles.mInput}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.muted}
                  keyboardType={f.keyboardType || 'default'}
                  value={courseForm[f.key]}
                  onChangeText={v => setCourseForm(p => ({ ...p, [f.key]: v }))}
                  autoCapitalize={f.key === 'course_code' ? 'characters' : 'words'}
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAddCourse} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Add Course</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Assessment Modal */}
      <Modal visible={showAssessModal} animationType="slide" transparent onRequestClose={() => setShowAssessModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Mark — {selectedCourse?.course_code}</Text>
              <TouchableOpacity onPress={() => setShowAssessModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {[
              { key: 'name',      label: 'Assessment Name *', placeholder: 'Midterm Exam',  keyboardType: 'default' },
              { key: 'weight',    label: 'Weight (%) *',      placeholder: '30',            keyboardType: 'numeric' },
              { key: 'score',     label: 'Score (optional)',   placeholder: '75',            keyboardType: 'numeric' },
              { key: 'max_score', label: 'Max Score',          placeholder: '100',           keyboardType: 'numeric' },
            ].map(f => (
              <View key={f.key} style={styles.mField}>
                <Text style={styles.mLabel}>{f.label}</Text>
                <TextInput
                  style={styles.mInput}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.muted}
                  keyboardType={f.keyboardType}
                  value={assessForm[f.key]}
                  onChangeText={v => setAssessForm(p => ({ ...p, [f.key]: v }))}
                  autoCapitalize="words"
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAddAssessment} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Mark</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, padding: 22, paddingBottom: 16 },

  heroCard: {
    marginHorizontal: 22, marginBottom: 16,
    borderRadius: 24, padding: 24, backgroundColor: Colors.accent2, overflow: 'hidden',
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  heroValue: { fontSize: 60, fontWeight: '800', color: 'white', lineHeight: 68 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroMini: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  heroMiniLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  heroMiniVal: { fontSize: 16, fontWeight: '800', color: 'white' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 22, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  addBtn: { fontSize: 12, color: Colors.accent, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: Colors.muted, textAlign: 'center', paddingHorizontal: 40 },

  courseList: { paddingHorizontal: 22, gap: 10 },
  courseCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16,
  },
  courseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  courseName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  courseCode: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  courseGrade: { fontSize: 26, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: Colors.surface2 ?? '#2a3045', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 99 },
  progressPct: { fontSize: 11, color: Colors.muted, marginTop: 6 },

  assessSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  assessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  assessTitle: { fontSize: 12, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.6 },
  noAssess: { fontSize: 12, color: Colors.muted, marginBottom: 8 },
  assessRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  assessName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  assessWeight: { fontSize: 11, color: Colors.muted },
  assessScore: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  delBtn: { padding: 4 },
  delBtnText: { color: Colors.accent3, fontSize: 14 },

  deleteCourseBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  deleteCourseBtnText: { fontSize: 12, color: Colors.accent3, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1 },
  modalClose: { fontSize: 18, color: Colors.muted, padding: 4 },

  mField: { marginBottom: 16 },
  mLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  mInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
