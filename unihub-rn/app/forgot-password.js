import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
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

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams();
  const [step, setStep]       = useState('email');   // 'email' → 'reset'
  const [email, setEmail]     = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode]       = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy]       = useState(false);

  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const longEnough = next.length >= 6;
  const matches    = next.length > 0 && next === confirm;
  const canReset   = code.length === 6 && longEnough && matches && !busy;

  async function sendCode() {
    if (!emailValid) {
      Alert.alert('Check your email', 'Enter the email you registered with.');
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        timeoutMs: 20000,
      });
      setStep('reset');
      Alert.alert('Check your inbox', data.message);
    } catch (e) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!canReset) return;
    setBusy(true);
    try {
      const data = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, new_password: next }),
      });
      Alert.alert('Password reset', data.message, [
        { text: 'Sign In', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      Alert.alert('Could not reset password', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forgot Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name={step === 'email' ? 'mail' : 'key'} size={26} color="white" />
            </View>
            <Text style={styles.heroTitle}>
              {step === 'email' ? 'Reset your password' : 'Enter your code'}
            </Text>
            <Text style={styles.heroSub}>
              {step === 'email'
                ? "Enter your account email and we'll send you a 6-digit code."
                : `We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`}
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.steps}>
            <View style={[styles.stepDot, styles.stepDotOn]}><Text style={styles.stepNum}>1</Text></View>
            <View style={[styles.stepLine, step === 'reset' && styles.stepLineOn]} />
            <View style={[styles.stepDot, step === 'reset' && styles.stepDotOn]}>
              <Text style={[styles.stepNum, step !== 'reset' && { color: Colors.muted }]}>2</Text>
            </View>
          </View>

          {step === 'email' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input} value={email} onChangeText={setEmail}
                placeholder="student@university.edu.my" placeholderTextColor={Colors.muted}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, (!emailValid || busy) && styles.btnDisabled]}
                onPress={sendCode} disabled={!emailValid || busy} activeOpacity={0.8}
              >
                {busy
                  ? <ActivityIndicator color="white" />
                  : <><Ionicons name="send" size={17} color="white" /><Text style={styles.primaryBtnText}>Send Code</Text></>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>6-Digit Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]} value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••" placeholderTextColor={Colors.muted}
                keyboardType="number-pad" maxLength={6}
              />

              <PasswordField label="New Password" value={next} onChangeText={setNext} placeholder="At least 6 characters" />
              <PasswordField label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter new password" />

              {/* Live checks */}
              <View style={styles.checks}>
                {[
                  { ok: code.length === 6, text: '6-digit code entered' },
                  { ok: longEnough,        text: 'At least 6 characters' },
                  { ok: matches,           text: 'Passwords match' },
                ].map(c => (
                  <View key={c.text} style={styles.checkRow}>
                    <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={15}
                      color={c.ok ? Colors.accent4 : Colors.muted} />
                    <Text style={[styles.checkText, c.ok && { color: Colors.accent4 }]}>{c.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !canReset && styles.btnDisabled]}
                onPress={resetPassword} disabled={!canReset} activeOpacity={0.8}
              >
                {busy
                  ? <ActivityIndicator color="white" />
                  : <><Ionicons name="shield-checkmark" size={18} color="white" /><Text style={styles.primaryBtnText}>Reset Password</Text></>}
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <TouchableOpacity onPress={sendCode} disabled={busy} style={styles.linkBtn}>
                  <Ionicons name="refresh" size={15} color={Colors.accent} />
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setStep('email'); setCode(''); }} disabled={busy} style={styles.linkBtn}>
                  <Ionicons name="create-outline" size={15} color={Colors.accent} />
                  <Text style={styles.linkText}>Change email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
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
    borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 18,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  stepDotOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepNum: { fontSize: 13, fontWeight: '800', color: 'white' },
  stepLine: { width: 60, height: 2, backgroundColor: Colors.border, marginHorizontal: 8 },
  stepLineOn: { backgroundColor: Colors.accent },

  label: { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },
  codeInput: { fontSize: 24, fontWeight: '800', letterSpacing: 10, textAlign: 'center' },
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

  linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 18 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  linkText: { fontSize: 13, fontWeight: '700', color: Colors.accent },
});
