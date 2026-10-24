import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiFetch } from '../constants/api';

function PasswordField({ label, value, onChangeText, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.inputText} value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={Colors.muted}
          secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setVisible(v => !v)} style={styles.eyeBtn}>
          <Ionicons name={visible ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving]   = useState(false);

  const longEnough = next.length >= 6;
  const matches    = next.length > 0 && next === confirm;
  const canSubmit  = current.length > 0 && longEnough && matches && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent(''); setNext(''); setConfirm('');
      Alert.alert('Password changed', 'Use your new password the next time you sign in.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not change password', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="lock-closed" size={26} color="white" /></View>
          <Text style={styles.heroTitle}>Update your password</Text>
          <Text style={styles.heroSub}>Enter your current password, then choose a new one.</Text>
        </View>

        <PasswordField label="Current Password" value={current} onChangeText={setCurrent} placeholder="••••••••" />
        <PasswordField label="New Password" value={next} onChangeText={setNext} placeholder="At least 6 characters" />
        <PasswordField label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter new password" />

        {/* Live checks */}
        <View style={styles.checks}>
          <View style={styles.checkRow}>
            <Ionicons name={longEnough ? 'checkmark-circle' : 'ellipse-outline'} size={15}
              color={longEnough ? Colors.accent4 : Colors.muted} />
            <Text style={[styles.checkText, longEnough && { color: Colors.accent4 }]}>At least 6 characters</Text>
          </View>
          <View style={styles.checkRow}>
            <Ionicons name={matches ? 'checkmark-circle' : 'ellipse-outline'} size={15}
              color={matches ? Colors.accent4 : Colors.muted} />
            <Text style={[styles.checkText, matches && { color: Colors.accent4 }]}>Passwords match</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit} disabled={!canSubmit} activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <><Ionicons name="shield-checkmark" size={18} color="white" /><Text style={styles.primaryBtnText}>Change Password</Text></>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

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
  heroIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  label: { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 6, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingLeft: 14, marginBottom: 14,
  },
  inputText: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.text },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 12 },

  checks: { gap: 6, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 12.5, color: Colors.muted },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, marginTop: 8,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
