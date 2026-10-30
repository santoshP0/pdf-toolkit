// Storage can be disabled by browser settings or unavailable in private
// contexts. Processing files must keep working when persistence fails.
export const storage = {
  getItem(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; }
    catch { return null; }
  },
  setItem(key, value) {
    try { globalThis.localStorage?.setItem(key, String(value)); return true; }
    catch { return false; }
  },
  removeItem(key) {
    try { globalThis.localStorage?.removeItem(key); return true; }
    catch { return false; }
  },
};
