/**
 * notifications.js
 *
 * Deadline reminders and clash alerts, scheduled as local notifications on the
 * device (works in Expo Go — no push server needed). syncNotifications() wipes
 * and re-schedules everything from the latest tasks + clashes, so call it
 * whenever that data may have changed.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

const PREF_KEYS = { deadlines: 'unihub_notif_deadlines', clash: 'unihub_notif_clash' };
const CLASH_ALERTED_KEY = 'unihub_clash_alerted';
const CHANNEL_ID = 'reminders';
const MAX_SCHEDULED = 60;           // iOS keeps at most 64 pending notifications
const LOOKAHEAD_DAYS = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ── Preferences (Profile toggles) ────────────────────────────────────────────
export async function getNotificationPrefs() {
  const [d, c] = await Promise.all([
    AsyncStorage.getItem(PREF_KEYS.deadlines),
    AsyncStorage.getItem(PREF_KEYS.clash),
  ]);
  return { deadlines: d !== '0', clash: c !== '0' };   // both on by default
}

export async function setNotificationPref(name, enabled) {
  await AsyncStorage.setItem(PREF_KEYS[name], enabled ? '1' : '0');
  if (enabled) await ensurePermission();
  return syncNotifications();
}

// ── Permission + Android channel ─────────────────────────────────────────────
async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Deadlines & clashes',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Accepts 'YYYY-MM-DD' or an ISO timestamp and returns local midnight of that day.
function toLocalDay(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function at(day, daysBefore, hour) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - daysBefore, hour, 0, 0);
}

function dayLabel(day) {
  return day.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Build the list of notifications to schedule ──────────────────────────────
function deadlineNotifications(tasks, now) {
  const out = [];
  for (const t of tasks) {
    if (t.is_done) continue;
    const due = toLocalDay(t.due_date);
    if (!due) continue;
    const course = t.course_code || t.course;
    const what = course ? `${t.title} (${course})` : t.title;
    out.push(
      { date: at(due, 1, 9), title: 'Due tomorrow', body: what, data: { type: 'deadline', taskId: t.id } },
      { date: at(due, 0, 8), title: 'Due today',    body: what, data: { type: 'deadline', taskId: t.id } },
    );
  }
  return out.filter(n => n.date > now);
}

async function clashNotifications(clashes, now) {
  const alerted = JSON.parse((await AsyncStorage.getItem(CLASH_ALERTED_KEY)) || '[]');
  const today = toLocalDay(now.toISOString());
  const stillRelevant = alerted.filter(k => toLocalDay(k.split('|')[0]) >= today);

  const out = [];
  for (const c of clashes) {
    const day = toLocalDay(c.date);
    if (!day || day < today) continue;
    const titles = (c.items || []).map(i => i.title).slice(0, 3).join(', ');
    const n = {
      title: `Clash: ${c.count} deadlines on ${dayLabel(day)}`,
      body:  c.suggestion
        ? `${titles}. Try finishing "${c.suggestion.title}" early.`
        : titles,
      data:  { type: 'clash', date: c.date },
    };
    const warnAt = at(day, 2, 9);
    const key = `${c.date}|${c.count}`;
    if (warnAt > now) {
      out.push({ ...n, date: warnAt });
    } else if (!stillRelevant.includes(key)) {
      // Clash is less than 2 days away and the student hasn't been told yet.
      out.push({ ...n, date: null });
      stillRelevant.push(key);
    }
  }
  await AsyncStorage.setItem(CLASH_ALERTED_KEY, JSON.stringify(stillRelevant));
  return out;
}

function triggerFor(date) {
  const channel = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {};
  if (!date) {
    return { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, ...channel };
  }
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...channel };
}

// ── Public: re-schedule everything ───────────────────────────────────────────
let running = Promise.resolve();

export function syncNotifications() {
  // Serialise calls so overlapping screen loads don't double-schedule.
  running = running.then(doSync).catch(e => console.warn('Notification sync error:', e.message));
  return running;
}

async function doSync() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const token = await AsyncStorage.getItem('unihub_token');
  const prefs = await getNotificationPrefs();
  if (!token || (!prefs.deadlines && !prefs.clash)) return;
  if (!(await ensurePermission())) return;

  const now = new Date();
  const horizon = at(now, -LOOKAHEAD_DAYS, 23);
  const [tasksData, clashData] = await Promise.all([
    prefs.deadlines ? apiFetch('/tasks?done=0') : { tasks: [] },
    prefs.clash     ? apiFetch('/schedule/clash') : { clashes: [] },
  ]);

  const pending = [
    ...(await clashNotifications(clashData.clashes || [], now)),
    ...deadlineNotifications(tasksData.tasks || [], now),
  ]
    .filter(n => !n.date || n.date <= horizon)
    .sort((a, b) => (a.date || 0) - (b.date || 0))
    .slice(0, MAX_SCHEDULED);

  for (const n of pending) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: n.data },
      trigger: triggerFor(n.date),
    });
  }
}

export async function clearNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(CLASH_ALERTED_KEY);
}
