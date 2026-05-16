import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './Config';

export async function apiFetch(path, options = {}) {
  const token = await AsyncStorage.getItem('unihub_token');
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res  = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out. Check your network or server.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
