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
  const res  = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
