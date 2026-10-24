import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

export default function EditProfileScreen() {
  const [loading, setLoading]     = useState(true);
  const [studentId, setStudentId] = useState('');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [original, setOriginal]   = useState({ name: '', email: '' });
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/me');
      setStudentId(data.user.student_id || '');
      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setOriginal({ name: data.user.name || '', email: data.user.email || '' });
    } catch (e) {
      // Fall back to the cached user if the server can't be reached
      const raw = await AsyncStorage.getItem('unihub_user');
      if (raw) {
        const u = JSON.parse(raw);
        setStudentId(u.student_id || '');
        setName(u.name || '');
        setEmail(u.email || '');
        setOriginal({ name: u.name || '', email: u.email || '' });
      }
      console.warn('profile load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changed = name.trim() !== original.name || email.trim().toLowerCase() !== original.email;

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Name and email cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      await AsyncStorage.setItem('unihub_token', data.token);
      await AsyncStorage.setItem('unihub_user', JSON.stringify(data.user));
      setOriginal({ name: data.user.name, email: data.user.email });
      Alert.alert('Profile updated', 'Your details have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  const initials = name.trim()
    ? name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>

        {/* Avatar */}
        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.heroTitle}>{name.trim() || 'Student'}</Text>
          <Text style={styles.heroSub}>Keep your details up to date</Text>
        </View>

        <Text style={styles.label}>Student ID</Text>
        <View style={[styles.input, styles.inputLocked]}>
          <Text style={styles.lockedText}>{studentId || '—'}</Text>
          <Ionicons name="lock-closed" size={14} color={Colors.muted} />
        </View>
        <Text style={styles.fieldHint}>Your student ID can't be changed.</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input} value={name} onChangeText={setName}
          placeholder="Your full name" placeholderTextColor={Colors.muted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input} value={email} onChangeText={setEmail}
          placeholder="you@student.edu.my" placeholderTextColor={Colors.muted}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        />

        <TouchableOpacity
          style={[styles.primaryBtn, (!changed || saving) && styles.btnDisabled]}
          onPress={handleSave} disabled={!changed || saving} activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <><Ionicons name="checkmark" size={18} color="white" /><Text style={styles.primaryBtnText}>Save Changes</Text></>}
        </TouchableOpacity>

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
  avatar: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: 'white' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, marginTop: 4 },

  label: { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },
  inputLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bg, marginBottom: 4,
  },
  lockedText: { fontSize: 15, color: Colors.muted },
  fieldHint: { fontSize: 11.5, color: Colors.muted, marginBottom: 14 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, marginTop: 8,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
