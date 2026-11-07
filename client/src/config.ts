export const DEFAULT_ONLINE_SERVER = 'https://beautiful-framed-thinking-eat.trycloudflare.com';

export const getApiUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:4000';

  // 1. Check if user configured a custom server URL
  const savedServer = localStorage.getItem('pritonn_server_url');
  if (savedServer && savedServer.trim()) {
    return savedServer.trim().replace(/\/+$/, '');
  }

  // 2. Detect mobile app (Capacitor Android / iOS)
  const isCapacitor =
    (window as any).Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80'));

  if (isCapacitor) {
    return DEFAULT_ONLINE_SERVER;
  }

  // 3. When running Vite dev server locally on PC
  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'http://localhost:4000';
  }

  // 4. When running inside Desktop Electron with file://
  if (window.location.protocol === 'file:') {
    return 'http://localhost:4000';
  }

  // 5. When running in a standard web browser on Cloudflare, Render, Railway, etc.
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
