import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';
import ExamPrep from '../components/ExamPrep';

const DOW = [Colors.accent, Colors.accent4, Colors.accent2, Colors.warn, Colors.accent3, Colors.teal, Colors.accent];

export default function StudyPlannerScreen() {
  const [tab, setTab]         = useState('plan');   // 'plan' | 'exam'
  const [loading, setLoading] = useState(false);
  const [plan, setPlan]       = useState(null);
  const [note, setNote]       = useState(null);
  const [error, setError]     = useState(null);

  async function generate() {
    setLoading(true); setError(null); setNote(null); setPlan(null);
    try {
      const data = await apiFetch('/ai/study-plan', { method: 'POST', timeoutMs: 90000 });
      if (data.empty) { setNote(data.message); }
      else { setPlan(data.plan); }
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Study Planner</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* Weekly Plan | Exam Prep */}
        <View style={styles.tabs}>
          {[{ key: 'plan', label: 'Weekly Plan', icon: 'calendar' }, { key: 'exam', label: 'Exam Prep', icon: 'school' }].map(t => (
            <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? 'white' : Colors.muted} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'exam' ? <ExamPrep /> : (<>

        {/* Intro / action */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="sparkles" size={24} color="white" /></View>
          <Text style={styles.heroTitle}>AI Study Plan</Text>
          <Text style={styles.heroSub}>
            Generates a 7-day study schedule around your classes, prioritising your nearest deadlines.
          </Text>
          <TouchableOpacity style={styles.genBtn} onPress={generate} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <><ActivityIndicator color="white" /><Text style={styles.genBtnText}>  Planning your week…</Text></>
              : <><Ionicons name="sparkles" size={18} color="white" /><Text style={styles.genBtnText}>  {plan ? 'Regenerate Plan' : 'Generate My Plan'}</Text></>}
          </TouchableOpacity>
        </View>

        {loading && (
          <Text style={styles.hint}>This can take 10–30 seconds while the AI reasons over your tasks.</Text>
        )}

        {error && (
          <View style={styles.errBox}><Ionicons name="alert-circle" size={18} color={Colors.accent3} />
            <Text style={styles.errText}>{error}</Text></View>
        )}

        {note && (
          <View style={styles.noteBox}><Ionicons name="information-circle" size={18} color={Colors.accent} />
            <Text style={styles.noteText}>{note}</Text></View>
        )}

        {plan && (
          <>
            {plan.summary ? (
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>THIS WEEK</Text>
                <Text style={styles.summaryText}>{plan.summary}</Text>
              </View>
            ) : null}

            {(plan.days || []).map((d, i) => {
              const color = DOW[i % DOW.length];
              const empty = !d.sessions || d.sessions.length === 0;
              return (
                <View key={i} style={styles.dayCard}>
                  <View style={styles.dayHead}>
                    <View style={[styles.dayDot, { backgroundColor: color }]} />
                    <Text style={styles.dayName}>{d.day}</Text>
                    <Text style={styles.dayDate}>{d.date}</Text>
                  </View>
                  {empty ? (
                    <Text style={styles.restText}>Rest day — no study scheduled 🎉</Text>
                  ) : (
                    d.sessions.map((s, j) => (
                      <View key={j} style={styles.session}>
                        <View style={styles.sessionTime}>
                          <Text style={[styles.sessionTimeText, { color }]}>{s.start}</Text>
                          <Text style={styles.sessionTimeDash}>–</Text>
                          <Text style={[styles.sessionTimeText, { color }]}>{s.end}</Text>
                        </View>
                        <View style={styles.sessionBody}>
                          <Text style={styles.sessionTitle}>{s.title}</Text>
                          {s.course ? <Text style={styles.sessionCourse}>{s.course}</Text> : null}
                          {s.why ? <Text style={styles.sessionWhy}>{s.why}</Text> : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            {(plan.tips && plan.tips.length) ? (
              <View style={styles.tips}>
                <Text style={styles.tipsLabel}>💡 TIPS</Text>
                {plan.tips.map((t, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.footer}>Generated by AI · review and adjust to fit your day.</Text>
          </>
        )}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  tabs: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 4, marginBottom: 16, gap: 4,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: Colors.accent2 },
  tabText: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  tabTextActive: { color: 'white' },

  hero: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 16,
  },
  heroIcon: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19, marginBottom: 18 },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, width: '100%',
  },
  genBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: 14 },

  errBox: { flexDirection: 'row', gap: 8, backgroundColor: `${Colors.accent3}15`, borderWidth: 1, borderColor: `${Colors.accent3}44`, borderRadius: 12, padding: 12, marginBottom: 12 },
  errText: { flex: 1, color: Colors.accent3, fontSize: 13 },
  noteBox: { flexDirection: 'row', gap: 8, backgroundColor: `${Colors.accent}12`, borderWidth: 1, borderColor: `${Colors.accent}33`, borderRadius: 12, padding: 12, marginBottom: 12 },
  noteText: { flex: 1, color: Colors.muted, fontSize: 13 },

  summary: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: Colors.accent2, letterSpacing: 1, marginBottom: 6 },
  summaryText: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  dayCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  dayName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  dayDate: { fontSize: 12, color: Colors.muted, marginLeft: 'auto' },
  restText: { fontSize: 13, color: Colors.muted, fontStyle: 'italic' },

  session: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  sessionTime: { width: 54, alignItems: 'center' },
  sessionTimeText: { fontSize: 12, fontWeight: '800' },
  sessionTimeDash: { fontSize: 10, color: Colors.muted },
  sessionBody: { flex: 1 },
  sessionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  sessionCourse: { fontSize: 12, color: Colors.accent, marginTop: 2, fontWeight: '600' },
  sessionWhy: { fontSize: 12, color: Colors.muted, marginTop: 3, lineHeight: 17 },

  tips: {
    backgroundColor: `${Colors.warn}12`, borderWidth: 1, borderColor: `${Colors.warn}33`,
    borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 10,
  },
  tipsLabel: { fontSize: 10, fontWeight: '800', color: Colors.warn, letterSpacing: 1, marginBottom: 8 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tipBullet: { color: Colors.warn, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },

  footer: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: 8 },
});
