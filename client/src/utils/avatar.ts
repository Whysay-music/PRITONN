import { API_BASE_URL } from '../config';

/**
 * Universal Avatar URL resolver for PRITONN across Web, PC (Electron), and Android (Capacitor).
 * Guarantees that avatars load regardless of where the server or image is hosted.
 */
export const getAvatarUrl = (avatar?: string | null, name?: string): string => {
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'user')}`;

  if (!avatar || typeof avatar !== 'string' || !avatar.trim()) {
    return fallback;
  }

  const trimmed = avatar.trim();

  // If avatar contains hardcoded localhost:4000 from old uploads, redirect to current API_BASE_URL
  if (trimmed.includes('localhost:4000/uploads/')) {
    const filename = trimmed.split('localhost:4000/uploads/')[1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }

  // If avatar is a relative /uploads/ path
  if (trimmed.startsWith('/uploads/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  // If avatar is a relative asset from public directory (e.g. /telegram-saved.svg, /logo.jpg)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  return trimmed;
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
