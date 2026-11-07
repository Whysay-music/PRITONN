export const APP_VERSION = '5.15.0';
export const GITHUB_REPO = 'Whysay-music/PRITONN';
export const DEFAULT_ONLINE_SERVER = 'https://pritonn-production.up.railway.app';

export const getApiUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_ONLINE_SERVER;

  // 1. Check if user configured a custom server URL
  const savedServer = localStorage.getItem('pritonn_server_url');
  if (savedServer && savedServer.trim()) {
    return savedServer.trim().replace(/\/+$/, '');
  }

  // 2. When running Vite dev server locally during active development
  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'http://localhost:4000';
  }

  // 3. Detect mobile app (Capacitor Android / iOS)
  const isCapacitor =
    (window as any).Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80'));

  if (isCapacitor) {
    return DEFAULT_ONLINE_SERVER;
  }

  // 4. When running inside Desktop Electron with file:// or electronAPI
  if ((window as any).electronAPI || window.location.protocol === 'file:') {
    return DEFAULT_ONLINE_SERVER;
  }

  // 5. When running in a standard web browser on Railway, Render, etc.
  return window.location.origin;
};

export const getSocketUrl = (): string => {
  return getApiUrl();
};

export let API_BASE_URL = getApiUrl();

export const setCustomServerUrl = (url: string) => {
  if (!url || !url.trim()) {
    localStorage.removeItem('pritonn_server_url');
  } else {
    localStorage.setItem('pritonn_server_url', url.trim().replace(/\/+$/, ''));
  }
  API_BASE_URL = getApiUrl();
};
