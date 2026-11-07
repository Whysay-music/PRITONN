export const getApiUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  
  // When running Vite dev server locally
  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'http://localhost:4000';
  }
  // When running inside Electron with file://
  if (window.location.protocol === 'file:') {
    return 'http://localhost:4000';
  }
  // When hosted on any domain, tunnel, Render, Railway, or local network
  return window.location.origin;
};

export const API_BASE_URL = getApiUrl();
