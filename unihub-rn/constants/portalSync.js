import { Alert } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from './api';

// Pull timetable, grades and assignments from the student portal.
// If the account isn't linked (or the session expired), offers to open the
// portal screen. Resolves to true when the sync succeeded.
export async function syncPortal() {
  try {
    const data = await apiFetch('/portal-link/sync', { method: 'POST', timeoutMs: 30000 });
    Alert.alert('Portal synced', data.message || 'Your portal data is up to date.');
    return true;
  } catch (e) {
    if (/not connected|reconnect|expired/i.test(e.message)) {
      Alert.alert('Connect your portal', 'Link your student portal account to sync your tasks.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => router.push('/portal') },
      ]);
    } else {
      Alert.alert('Sync failed', e.message);
    }
    return false;
  }
}
