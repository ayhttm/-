const memoryFallback = new Map<string, string>();

export function safeGetStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function safeSetStorageItem(key: string, value: string): void {
  memoryFallback.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or sandboxed iframe restrictions
  }
}

export function safeRemoveStorageItem(key: string): void {
  memoryFallback.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions
  }
}

export function readPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = safeGetStorageItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePersisted<T>(key: string, value: T): void {
  try {
    safeSetStorageItem(key, JSON.stringify(value));
  } catch {
    // Ignore serialization errors
  }
}
