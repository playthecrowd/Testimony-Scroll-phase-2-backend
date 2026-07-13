// Small localStorage wrapper used by the mock service layer.
// Phase Two will swap these calls for Supabase queries behind the same service function signatures.

const PREFIX = "qftk:";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadCollection<T>(key: string, seed: T[]): T[] {
  if (!isBrowser()) return seed;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return seed;
  }
}

export function saveCollection<T>(key: string, data: T[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore quota / serialization errors in the prototype
  }
}

export function loadValue<T>(key: string, seed: T): T {
  if (!isBrowser()) return seed;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as T;
  } catch {
    return seed;
  }
}

export function saveValue<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function resetAll() {
  if (!isBrowser()) return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
