// Per-browser conveniences only. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the app must still work.

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The preference just won't persist.
  }
}
