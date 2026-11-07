import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from './api';

const CHECK_EVERY_MS = 30000;

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

// Quietly pull any new assignments from the portal. Failures are ignored, since
// this runs in the background and the next check simply tries again.
let checking = null;
function checkNewAssignments() {
  if (!checking) {
    checking = apiFetch('/portal-link/sync-assignments', { method: 'POST' })
      .then(data => data.added || [])
      .catch(() => [])
      .finally(() => { checking = null; });
  }
  return checking;
}

function announce(added) {
  const line = a => `${a.title}${a.course_code ? ` (${a.course_code})` : ''}`;
  if (added.length === 1) {
    const a = added[0];
    const due = a.due_date
      ? `\nDue ${new Date(`${a.due_date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })}${a.due_time ? `, ${a.due_time}` : ''}`
      : '';
    Alert.alert('New assignment', `${line(a)}${due}`);
  } else {
    const more = added.length > 3 ? `\n…and ${added.length - 3} more` : '';
    Alert.alert(`${added.length} new assignments`, added.slice(0, 3).map(line).join('\n') + more);
  }
}

// While a screen is focused, checks the portal for assignments posted by lecturers.
// Tells the student when one arrives and calls onNew so the screen can refresh.
export function useNewAssignments(onNew) {
  useFocusEffect(useCallback(() => {
    let active = true;
    const check = async () => {
      const added = await checkNewAssignments();
      if (active && added.length) {
        announce(added);
        onNew();
      }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => { active = false; clearInterval(timer); };
  }, [onNew]));
}
