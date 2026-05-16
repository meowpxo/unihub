import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { API_BASE_URL } from '../constants/Config';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      await AsyncStorage.setItem('unihub_token', data.token);
      await AsyncStorage.setItem('unihub_user', JSON.stringify(data.user));
      router.replace('/');
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Connection timed out. Make sure the server is running and the IP is correct.'
        : err.message;
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          {/* Logo / Brand */}
          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>U</Text>
            </View>
            <Text style={styles.appName}>UniHub</Text>
            <Text style={styles.tagline}>Your unified academic companion</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back 👋</Text>
            <Text style={styles.cardSub}>Sign in to your student account</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                <Ionicons name="mail" size={18} color="#4f8ef7" />
                <TextInput
                  style={styles.input}
                  placeholder="student@university.edu.my"
                  placeholderTextColor={Colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: null })); }}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed" size={18} color="#7b5ea7" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.muted}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: null })); }}
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} activeOpacity={0.7}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color="#38c9a0" />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.loginBtnText}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  container: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 20,
  },

  brand: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  logoText: { fontSize: 34, fontWeight: '900', color: 'white' },
  appName: { fontSize: 28, fontWeight: '900', color: Colors.text, letterSpacing: 0.5 },
  tagline: { fontSize: 13, color: Colors.muted, marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 24, padding: 24,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: Colors.muted, marginBottom: 22 },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, height: 50,
    gap: 10,
  },
  inputError: { borderColor: Colors.accent3 },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: Colors.text, height: '100%' },
  errorText: { fontSize: 11, color: Colors.accent3, marginTop: 5 },

  forgotRow: { alignItems: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 12, color: Colors.accent, fontWeight: '600' },

  loginBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.muted },

  registerBtn: {
    borderWidth: 1.5, borderColor: Colors.accent,
    borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  registerBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },

  footer: { textAlign: 'center', fontSize: 11, color: Colors.muted, marginTop: 24 },
});
