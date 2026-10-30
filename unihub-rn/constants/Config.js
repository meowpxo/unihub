import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The backend runs on the same PC as the Expo dev server, so in development we
// reuse the IP Expo is serving from (e.g. "192.168.2.252:8081"). This keeps
// working when the PC's Wi-Fi IP changes, on a real phone and on the emulator.
let devHost = Constants.expoConfig?.hostUri?.split(':')[0];

// When the Android emulator loads the app from 127.0.0.1 / localhost, that address
// means the emulator itself — 10.0.2.2 is the emulator's built-in route to the PC.
if (Platform.OS === 'android' && (devHost === '127.0.0.1' || devHost === 'localhost')) {
  devHost = '10.0.2.2';
}

// Used only if Expo can't tell us its host (e.g. a standalone build).
const FALLBACK_HOST = '192.168.2.252';

export const API_BASE_URL = 'https://weddings-pack-wondering-nominations.trycloudflare.com/api';
