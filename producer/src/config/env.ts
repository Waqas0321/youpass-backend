export function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return '';
}

export function devLoginDefaults() {
  if (!import.meta.env.DEV) {
    return { email: '', password: '' };
  }

  return {
    email: import.meta.env.VITE_DEV_LOGIN_EMAIL?.trim() || 'producer@youpass.com',
    password: import.meta.env.VITE_DEV_LOGIN_PASSWORD || 'youpass123',
  };
}
