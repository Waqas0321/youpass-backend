const STORAGE_KEY = 'youpass-producer-session';

export type ProducerSession = {
  email: string;
  token: string;
  producerId?: string;
  producerName?: string;
};

export function getSession(): ProducerSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProducerSession;
  } catch {
    return null;
  }
}

export function saveSession(session: ProducerSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(getSession()?.token);
}
