import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

// Exam Prep tab of the Smart Study Planner: reads the course CLP from the
// student portal and predicts the upcoming quizzes/tests/final exam, their
// possible question format and practice questions, aligned with the CLOs.

const TYPE_COLOR = {
  quiz: Colors.accent4, test: Colors.accent, midterm: Colors.purple,
  lab_test: Colors.teal, final: Colors.accent3, other: Colors.muted,
};
const CONF_COLOR = { high: Colors.accent4, medium: Colors.warn, low: Colors.accent3 };

function Chip({ text, color = Colors.accent }) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}>
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </View>
  );
}

function Section({ title, icon, children, initiallyOpen = true }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.sectionHead} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Ionicons name={icon} size={17} color={Colors.accent2} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.muted} />
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

function AssessmentCard({ a }) {
  const color = TYPE_COLOR[a.type] || Colors.accent;
  return (
    <View style={[styles.card, styles.assessCard, { borderLeftColor: color }]}>
      <View style={styles.assessHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.assessName}>{a.name}</Text>
          <Text style={styles.assessMeta}>
            {[a.week, a.dates].filter(Boolean).join(' · ')}
            {typeof a.days_away === 'number' ? `  ·  in ${a.days_away} day${a.days_away === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        {a.weightage ? <View style={[styles.weight, { backgroundColor: color }]}><Text style={styles.weightText}>{a.weightage}</Text></View> : null}
      </View>

      <View style={styles.chipRow}>
        {(a.clos || []).map(c => <Chip key={c} text={c} color={Colors.accent2} />)}
        {a.confidence ? <Chip text={`${a.confidence} confidence`} color={CONF_COLOR[a.confidence] || Colors.muted} /> : null}
      </View>
      {a.why ? <Text style={styles.why}>{a.why}</Text> : null}

      {(a.covers || []).length ? (
        <>
          <Text style={styles.label}>LIKELY COVERS</Text>
          {a.covers.map((t, i) => <Text key={i} style={styles.bullet}>•  {t}</Text>)}
        </>
      ) : null}

      {(a.format || []).length ? (
        <>
          <Text style={styles.label}>POSSIBLE QUESTION FORMAT</Text>
          {a.format.map((f, i) => (
            <View key={i} style={styles.formatRow}>
              <View style={styles.formatTop}>
                <Text style={styles.formatSection}>{f.section}</Text>
                <Text style={styles.formatType}>{f.question_type}</Text>
                <Text style={styles.formatMarks}>
                  {f.questions ? `${f.questions} Q` : ''}{f.questions && f.marks ? ' · ' : ''}{f.marks ? `${f.marks} marks` : ''}
                </Text>
              </View>
              {f.description ? <Text style={styles.formatDesc}>{f.description}</Text> : null}
              <View style={styles.chipRow}>
                {f.clo ? <Chip text={f.clo} color={Colors.accent2} /> : null}
                {f.bloom ? <Chip text={f.bloom} color={Colors.purple} /> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {(a.practice_questions || []).length ? (
        <>
          <Text style={styles.label}>PRACTICE QUESTIONS</Text>
          {a.practice_questions.map((q, i) => (
            <View key={i} style={styles.question}>
              <Text style={styles.qText}><Text style={styles.qNum}>{i + 1}. </Text>{q.question}</Text>
              <View style={styles.chipRow}>
                {q.type ? <Chip text={q.type} color={Colors.accent} /> : null}
                {q.clo ? <Chip text={q.clo} color={Colors.accent2} /> : null}
                {q.bloom ? <Chip text={q.bloom} color={Colors.purple} /> : null}
                {q.marks ? <Chip text={`${q.marks} marks`} color={Colors.muted} /> : null}
                {q.taught === false ? <Chip text="Not taught yet" color={Colors.warn} /> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {(a.prep_tips || []).length ? (
        <View style={styles.tips}>
          <Text style={styles.tipsLabel}>💡 HOW TO PREPARE</Text>
          {a.prep_tips.map((t, i) => <Text key={i} style={styles.tipText}>•  {t}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

export default function ExamPrep() {
  const [courses, setCourses]   = useState(null);   // null = loading
  const [connected, setConnected] = useState(true);
  const [listMsg, setListMsg]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [result, setResult]     = useState(null);
  const [note, setNote]         = useState(null);
  const [error, setError]       = useState(null);

  async function loadCourses() {
    setCourses(null); setListMsg(null);
    try {
      const data = await apiFetch('/ai/exam-prep/courses', { timeoutMs: 30000 });
      setConnected(data.connected);
      setCourses(data.courses || []);
      if (!data.connected) setListMsg(data.message);
      const first = (data.courses || []).find(c => c.has_clp);
      setSelected(s => s || first?.code || null);
    } catch (e) {
      setCourses([]);
      setListMsg(e.message);
    }
  }

  useEffect(() => { loadCourses(); }, []);

  async function predict(refresh = false) {
    if (!selected) return;
    setBusy(true); setError(null); setNote(null);
    if (!refresh) setResult(null);
    try {
      const data = await apiFetch('/ai/exam-prep', {
        method: 'POST', timeoutMs: 120000,
        body: JSON.stringify({ course_code: selected, refresh }),
      });
      if (data.noClp) { setNote(data.message); setResult(null); }
      else setResult(data);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const p = result?.prediction;
  const course = courses?.find(c => c.code === selected);

  return (
    <View>
      {/* Intro */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="school" size={24} color="white" /></View>
        <Text style={styles.heroTitle}>Exam Prep</Text>
        <Text style={styles.heroSub}>
          Reads your course's Course Learning Plan (CLP), finds your next quizzes, tests and final exam, and predicts
          the question format and practice questions for the topics you've finished — aligned with the CLOs.
        </Text>
      </View>

      {/* Course picker */}
      <Text style={styles.pickLabel}>CHOOSE A COURSE</Text>
      {courses === null ? (
        <ActivityIndicator color={Colors.accent} style={{ marginVertical: 16 }} />
      ) : !connected ? (
        <View style={styles.noteBox}>
          <Ionicons name="link" size={18} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noteText}>{listMsg}</Text>
            <TouchableOpacity onPress={() => router.push('/portal')}><Text style={styles.link}>Open Student Portal →</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {listMsg ? <Text style={styles.errInline}>{listMsg}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {courses.map(c => {
              const active = c.code === selected;
              return (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { if (c.has_clp) { setSelected(c.code); setResult(null); setNote(null); setError(null); } }}
                  activeOpacity={c.has_clp ? 0.8 : 1}
                  style={[styles.courseChip, active && styles.courseChipActive, !c.has_clp && styles.courseChipOff]}
                >
                  <Text style={[styles.courseCode, active && { color: 'white' }]}>{c.code}</Text>
                  <Text style={[styles.courseName, active && { color: 'white' }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[styles.courseClp, active && { color: '#dbe6ff' }, !c.has_clp && { color: Colors.muted }]}>
                    {c.has_clp ? '✔ CLP available' : 'No CLP yet'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.genBtn, (!selected || busy) && { opacity: 0.6 }]}
            onPress={() => predict(!!result)} disabled={!selected || busy} activeOpacity={0.85}
          >
            {busy
              ? <><ActivityIndicator color="white" /><Text style={styles.genBtnText}>  Reading the CLP…</Text></>
              : <><Ionicons name="sparkles" size={18} color="white" /><Text style={styles.genBtnText}>  {result ? 'Regenerate prediction' : 'Predict my exams'}</Text></>}
          </TouchableOpacity>
          {busy ? <Text style={styles.hint}>This can take 20–60 seconds while the AI reads the CLP.</Text> : null}
        </>
      )}

      {error ? (
        <View style={styles.errBox}><Ionicons name="alert-circle" size={18} color={Colors.accent3} />
          <Text style={styles.errText}>{error}</Text></View>
      ) : null}
      {note ? (
        <View style={styles.noteBox}><Ionicons name="information-circle" size={18} color={Colors.accent} />
          <Text style={styles.noteText}>{note}</Text></View>
      ) : null}

      {p ? (
        <>
          {/* Where we are in the semester */}
          <View style={styles.weekBanner}>
            <Text style={styles.weekLabel}>{(p.course?.code || selected)} · {p.course?.name || course?.name || ''}</Text>
            <Text style={styles.weekNow}>{p.current_week?.label || 'Current week'}{p.current_week?.dates ? `  ·  ${p.current_week.dates}` : ''}</Text>
            {p.current_week?.status ? <Text style={styles.weekStatus}>{p.current_week.status}</Text> : null}
            <Text style={styles.source}>From: {result.clp?.title}{result.clp?.lecturer ? ` (${result.clp.lecturer})` : ''}</Text>
          </View>

          {/* Upcoming assessments */}
          <Text style={styles.groupTitle}>UPCOMING ASSESSMENTS</Text>
          {(p.upcoming || []).length ? (
            p.upcoming.map((a, i) => <AssessmentCard key={i} a={a} />)
          ) : (
            <View style={styles.noteBox}><Ionicons name="information-circle" size={18} color={Colors.accent} />
              <Text style={styles.noteText}>{p.notes || 'No upcoming written assessments were found in this CLP.'}</Text></View>
          )}

          {/* CLOs */}
          {(p.clos || []).length ? (
            <Section title="Course Learning Outcomes" icon="ribbon" initiallyOpen={false}>
              {p.clos.map((c, i) => (
                <View key={i} style={styles.cloRow}>
                  <Text style={styles.cloId}>{c.id}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cloDesc}>{c.description}</Text>
                    {c.assessed_by ? <Text style={styles.cloBy}>Assessed by: {c.assessed_by}</Text> : null}
                  </View>
                </View>
              ))}
            </Section>
          ) : null}

          {/* Finished weeks */}
          {(p.completed || []).length ? (
            <Section title={`Finished so far (${p.completed.length} week${p.completed.length === 1 ? '' : 's'})`} icon="checkmark-done" initiallyOpen={false}>
              {p.completed.map((w, i) => (
                <View key={i} style={styles.doneRow}>
                  <Text style={styles.doneWeek}>{w.week}</Text>
                  <View style={{ flex: 1 }}>
                    {(w.topics || []).map((t, j) => <Text key={j} style={styles.bullet}>•  {t}</Text>)}
                    {(w.clos || []).length ? <View style={styles.chipRow}>{w.clos.map(c => <Chip key={c} text={c} color={Colors.accent2} />)}</View> : null}
                  </View>
                </View>
              ))}
            </Section>
          ) : null}

          <Text style={styles.footer}>
            {p.notes && (p.upcoming || []).length ? `${p.notes} ` : ''}
            Predicted by AI from the CLP — the real paper may differ.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 18,
  },
  heroIcon: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  pickLabel: { fontSize: 11, fontWeight: '800', color: Colors.muted, letterSpacing: 1, marginBottom: 8 },
  courseChip: {
    width: 170, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 12,
  },
  courseChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  courseChipOff: { opacity: 0.55 },
  courseCode: { fontSize: 11, fontWeight: '800', color: Colors.muted, letterSpacing: 0.5 },
  courseName: { fontSize: 13.5, fontWeight: '700', color: Colors.text, marginTop: 2 },
  courseClp: { fontSize: 11, fontWeight: '700', color: Colors.accent4, marginTop: 6 },

  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, marginTop: 14,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
  },
  genBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: 10 },

  errBox: { flexDirection: 'row', gap: 8, backgroundColor: `${Colors.accent3}12`, borderWidth: 1, borderColor: `${Colors.accent3}40`, borderRadius: 12, padding: 12, marginTop: 14 },
  errText: { flex: 1, color: Colors.accent3, fontSize: 13 },
  errInline: { color: Colors.accent3, fontSize: 12.5, marginBottom: 8 },
  noteBox: { flexDirection: 'row', gap: 8, backgroundColor: `${Colors.accent}10`, borderWidth: 1, borderColor: `${Colors.accent}30`, borderRadius: 12, padding: 12, marginTop: 10, marginBottom: 6 },
  noteText: { flex: 1, color: Colors.text, fontSize: 13, lineHeight: 19 },
  link: { color: Colors.accent, fontWeight: '800', fontSize: 13, marginTop: 6 },

  weekBanner: { backgroundColor: Colors.accent2, borderRadius: 18, padding: 18, marginTop: 18, marginBottom: 18 },
  weekLabel: { color: '#b9c7e0', fontSize: 12, fontWeight: '700' },
  weekNow: { color: 'white', fontSize: 20, fontWeight: '800', marginTop: 4 },
  weekStatus: { color: '#dbe4f3', fontSize: 13, marginTop: 4, lineHeight: 18 },
  source: { color: '#9fb0cc', fontSize: 11.5, marginTop: 10 },

  groupTitle: { fontSize: 11, fontWeight: '800', color: Colors.muted, letterSpacing: 1, marginBottom: 10 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginBottom: 14 },
  assessCard: { borderLeftWidth: 5 },
  assessHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  assessName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  assessMeta: { fontSize: 12.5, color: Colors.muted, marginTop: 3 },
  weight: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  weightText: { color: 'white', fontWeight: '800', fontSize: 13 },
  why: { fontSize: 12.5, color: Colors.muted, marginTop: 8, lineHeight: 18, fontStyle: 'italic' },

  label: { fontSize: 10.5, fontWeight: '800', color: Colors.accent2, letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  bullet: { fontSize: 13, color: Colors.text, lineHeight: 19, marginBottom: 3 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },

  formatRow: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: Colors.bg },
  formatTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  formatSection: { fontSize: 13, fontWeight: '800', color: Colors.text },
  formatType: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  formatMarks: { fontSize: 12, color: Colors.muted, marginLeft: 'auto', fontWeight: '700' },
  formatDesc: { fontSize: 12.5, color: Colors.muted, marginTop: 4, lineHeight: 18 },

  question: { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  qText: { fontSize: 13.5, color: Colors.text, lineHeight: 20 },
  qNum: { fontWeight: '800', color: Colors.accent },

  tips: { backgroundColor: `${Colors.warn}10`, borderWidth: 1, borderColor: `${Colors.warn}30`, borderRadius: 12, padding: 12, marginTop: 14 },
  tipsLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.warn, letterSpacing: 1, marginBottom: 6 },
  tipText: { fontSize: 13, color: Colors.text, lineHeight: 19, marginBottom: 3 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.text },
  cloRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cloId: { fontSize: 13, fontWeight: '800', color: Colors.accent2, width: 46 },
  cloDesc: { fontSize: 13, color: Colors.text, lineHeight: 19 },
  cloBy: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  doneRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  doneWeek: { fontSize: 12.5, fontWeight: '800', color: Colors.accent4, width: 60 },

  footer: { fontSize: 11.5, color: Colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 10, lineHeight: 17 },
});
