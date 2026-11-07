import { API_BASE_URL } from '../config';

/**
 * Universal Media URL resolver for PRITONN across Web, PC (Electron), and Android (Capacitor).
 * Resolves relative `/uploads/...` paths and legacy `localhost:4000/uploads/...` URLs
 * to the active backend (`API_BASE_URL`), while preserving `data:`, `blob:`, and external URLs.
 */
export const resolveMediaUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }

  const trimmed = url.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.includes('localhost:4000/uploads/')) {
    const filename = trimmed.split('localhost:4000/uploads/')[1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }

  if (trimmed.startsWith('/uploads/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  // Upgrade accidental http:// URLs pointing to the production Railway host to https://
  if (trimmed.startsWith('http://') && API_BASE_URL.startsWith('https://')) {
    try {
      const apiHost = new URL(API_BASE_URL).host;
      if (trimmed.includes(apiHost)) {
        return trimmed.replace(/^http:\/\//i, 'https://');
      }
    } catch {}
  }

  return trimmed;
};

/**
 * Universal Avatar URL resolver for PRITONN across Web, PC (Electron), and Android (Capacitor).
 * Guarantees that avatars load regardless of where the server or image is hosted.
 */
export const getAvatarUrl = (avatar?: string | null, name?: string): string => {
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'user')}`;

  if (!avatar || typeof avatar !== 'string' || !avatar.trim()) {
    return fallback;
  }

  const resolved = resolveMediaUrl(avatar);
  if (!resolved) {
    return fallback;
  }

  return resolved;
};

/**
 * Safe image onError handler to replace broken images with a stylish DiceBear SVG avatar
 */
export const handleAvatarError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  name?: string
) => {
  const target = e.currentTarget;
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'user')}`;
  if (target.src !== fallback) {
    target.src = fallback;
  }
};
