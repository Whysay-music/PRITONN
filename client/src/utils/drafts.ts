// Strict per-user, per-chat local draft storage (never shared across users!)

const getDraftStorageKey = (userId?: string | null, chatId?: string | null): string | null => {
  if (!userId || !chatId) return null;
  return `pritonn_draft_${userId}_${chatId}`;
};

export const getChatDraft = (userId?: string | null, chatId?: string | null): string => {
  if (typeof window === 'undefined') return '';
  const key = getDraftStorageKey(userId, chatId);
  if (!key) return '';
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

export const setChatDraft = (
  userId?: string | null,
  chatId?: string | null,
  text?: string | null
): void => {
  if (typeof window === 'undefined') return;
  const key = getDraftStorageKey(userId, chatId);
  if (!key) return;
  const normalized = text || '';
  try {
    if (!normalized.trim()) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, normalized);
    }
    window.dispatchEvent(
      new CustomEvent('pritonn-draft-updated', {
        detail: { userId, chatId, text: normalized.trim() ? normalized : '' },
      })
    );
  } catch {
    // Ignore storage quota errors
  }
};

export const clearChatDraft = (userId?: string | null, chatId?: string | null): void => {
  setChatDraft(userId, chatId, '');
};
