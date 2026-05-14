import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import { API_BASE_URL } from '../constants/Config';

export default function RegisterScreen() {
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.studentId.trim()) e.studentId = 'Student ID is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          student_id: form.studentId.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      Alert.alert('Account Created!', 'You can now sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/login') },
      ]);
    } catch (err) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { key: 'name', label: 'Full Name', icon: '👤', placeholder: 'Syed Muhammad Zulkifli', type: 'default' },
    { key: 'studentId', label: 'Student ID', icon: '🎓', placeholder: '52213224368', type: 'default' },
    { key: 'email', label: 'Email', icon: '✉', placeholder: 'student@student.uitm.edu.my', type: 'email-address' },
    { key: 'password', label: 'Password', icon: '🔒', placeholder: 'Min. 6 characters', secure: true },
    { key: 'confirm', label: 'Confirm Password', icon: '🔒', placeholder: 'Re-enter password', secure: true },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.sub}>Register as a UniHub student</Text>
          </View>

          <View style={styles.card}>
            {fields.map(f => (
              <View key={f.key} style={styles.fieldGroup}>
                <Text style={styles.label}>{f.label}</Text>
                <View style={[styles.inputWrapper, errors[f.key] && styles.inputError]}>
                  <Text style={styles.inputIcon}>{f.icon}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.muted}
                    keyboardType={f.type || 'default'}
                    autoCapitalize={f.type === 'email-address' ? 'none' : 'words'}
                    autoCorrect={false}
                    secureTextEntry={!!f.secure}
                    value={form[f.key]}
                    onChangeText={t => set(f.key, t)}
                  />
                </View>
                {errors[f.key] && <Text style={styles.errorText}>{errors[f.key]}</Text>}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.registerBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.registerBtnText}>Create Account</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginRowText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  backBtn: { marginBottom: 16 },
  backText: { fontSize: 14, color: Colors.accent, fontWeight: '600' },

  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.text },
  sub: { fontSize: 13, color: Colors.muted, marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 24, padding: 24,
  },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, height: 50, gap: 10,
  },
  inputError: { borderColor: Colors.accent3 },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: Colors.text, height: '100%' },
  errorText: { fontSize: 11, color: Colors.accent3, marginTop: 5 },

  registerBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  registerBtnText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginRowText: { fontSize: 13, color: Colors.muted },
  loginLink: { fontSize: 13, color: Colors.accent, fontWeight: '700' },
});
