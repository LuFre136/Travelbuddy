// Speicher für die Supabase-Sitzung. Mit „Angemeldet bleiben“ liegt sie in localStorage und
// übersteht Neustarts von Browser und App; ohne nur in sessionStorage bis zum Schließen.

const REMEMBER_KEY = 'tb-remember'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function getRemember(): boolean {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== 'false', true)
}

export function setRemember(remember: boolean): void {
  safe(() => {
    localStorage.setItem(REMEMBER_KEY, String(remember))
    // Eine bestehende Sitzung in den jeweils anderen Speicher umziehen.
    const [from, to] = remember ? [sessionStorage, localStorage] : [localStorage, sessionStorage]
    for (const key of Object.keys(from)) {
      if (!key.startsWith('sb-')) continue
      to.setItem(key, from.getItem(key)!)
      from.removeItem(key)
    }
  }, undefined)
}

export const authStorage = {
  getItem(key: string): string | null {
    return safe(() => localStorage.getItem(key) ?? sessionStorage.getItem(key), null)
  },
  setItem(key: string, value: string): void {
    safe(() => (getRemember() ? localStorage : sessionStorage).setItem(key, value), undefined)
  },
  removeItem(key: string): void {
    safe(() => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }, undefined)
  },
}
