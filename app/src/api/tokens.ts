import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The refresh token lives in the OS keystore (Keychain / Android Keystore);
// the short-lived access token only in memory.
const KEY = 'tend.refreshToken';
let access: string | null = null;

const store = {
  get: async () => (Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => (Platform.OS === 'web' ? globalThis.localStorage?.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v)),
  del: async () => (Platform.OS === 'web' ? globalThis.localStorage?.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};

export const tokens = {
  getAccess: () => access,
  getRefresh: () => store.get(),
  async set(accessToken: string, refreshToken: string) {
    access = accessToken;
    await store.set(refreshToken);
  },
  async clear() {
    access = null;
    await store.del();
  },
};
