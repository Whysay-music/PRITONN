// Cross-platform Notifications & Background Mode manager (Android APK, Windows Electron, Web)

export interface AppNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  chatId?: string;
  icon?: string;
  isCall?: boolean;
}

const NOTIF_STORAGE_KEY = 'pritonn_notifications_enabled';
const SOUND_STORAGE_KEY = 'pritonn_sound_enabled';
const BG_MODE_STORAGE_KEY = 'pritonn_bg_mode_enabled';

const getAndroidBridge = (): any => {
  if (typeof window === 'undefined') return null;
  return (window as any).AndroidAppBridge || null;
};

const getElectronAPI = (): any => {
  if (typeof window === 'undefined') return null;
  return (window as any).electronAPI || null;
};

export const isAndroidNative = (): boolean => {
  return !!getAndroidBridge();
};

export const isElectronDesktop = (): boolean => {
  return !!getElectronAPI();
};

export const areNotificationsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw !== null) return raw !== 'false';
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.areNotificationsEnabled === 'function') {
      return !!bridge.areNotificationsEnabled();
    }
  } catch {}
  return true;
};

export const setNotificationsEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, enabled ? 'true' : 'false');
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.setNotificationsEnabled === 'function') {
      bridge.setNotificationsEnabled(enabled);
    }
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    window.dispatchEvent(
      new CustomEvent('pritonn-settings-changed', { detail: { notificationsEnabled: enabled } })
    );
  } catch {}
};

export const areSoundsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (raw !== null) return raw !== 'false';
  } catch {}
  return true;
};

export const setSoundsEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(
      new CustomEvent('pritonn-settings-changed', { detail: { soundsEnabled: enabled } })
    );
  } catch {}
};

export const isBackgroundModeEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(BG_MODE_STORAGE_KEY);
    if (raw !== null) return raw !== 'false';
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.isBackgroundModeEnabled === 'function') {
      return !!bridge.isBackgroundModeEnabled();
    }
  } catch {}
  return true;
};

export const setBackgroundModeEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BG_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.setBackgroundModeEnabled === 'function') {
      bridge.setBackgroundModeEnabled(enabled);
    }
    const electron = getElectronAPI();
    if (electron && typeof electron.setBackgroundMode === 'function') {
      electron.setBackgroundMode(enabled);
    }
    window.dispatchEvent(
      new CustomEvent('pritonn-settings-changed', { detail: { backgroundModeEnabled: enabled } })
    );
  } catch {}
};

export const requestAndroidBatteryExemption = (): void => {
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.requestIgnoreBatteryOptimizations === 'function') {
    try {
      bridge.requestIgnoreBatteryOptimizations();
    } catch {}
  }
};

export const syncNativeBackgroundSettings = (): void => {
  const notifEnabled = areNotificationsEnabled();
  const bgEnabled = isBackgroundModeEnabled();
  const bridge = getAndroidBridge();
  if (bridge) {
    try {
      if (typeof bridge.setNotificationsEnabled === 'function') {
        bridge.setNotificationsEnabled(notifEnabled);
      }
      if (typeof bridge.setBackgroundModeEnabled === 'function') {
        bridge.setBackgroundModeEnabled(bgEnabled);
      }
    } catch {}
  }
  const electron = getElectronAPI();
  if (electron && typeof electron.setBackgroundMode === 'function') {
    try {
      electron.setBackgroundMode(bgEnabled);
    } catch {}
  }
};

export const showAppNotification = (payload: AppNotificationPayload): void => {
  if (typeof window === 'undefined') return;
  if (!areNotificationsEnabled()) return;

  const title = (payload.title || 'PRITONN').slice(0, 120);
  const body = (payload.body || 'Новое уведомление').slice(0, 260);
  const tag = payload.tag || payload.chatId || 'pritonn_msg';
  const isCall = !!payload.isCall;

  // 1. Android Native Notification Channel (works even when screen is off / app is minimized)
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.showNotification === 'function') {
    try {
      bridge.showNotification(title, body, tag, isCall);
      return;
    } catch {}
  }

  // 2. Windows / Desktop Electron OS Notification
  const electron = getElectronAPI();
  if (electron && typeof electron.showNotification === 'function') {
    try {
      electron.showNotification({
        title,
        body,
        chatId: payload.chatId || '',
        isCall,
      });
      return;
    } catch {}
  }

  // 3. Standard Web Browser Notification API
  if ('Notification' in window) {
    const fireWebNotif = () => {
      try {
        const notif = new Notification(title, {
          body,
          icon: payload.icon || '/favicon.ico',
          tag,
        });
        notif.onclick = () => {
          window.focus();
          if (payload.chatId) {
            window.dispatchEvent(
              new CustomEvent('pritonn-open-chat', { detail: { chatId: payload.chatId } })
            );
          }
          notif.close();
        };
      } catch {}
    };

    if (Notification.permission === 'granted') {
      fireWebNotif();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === 'granted') fireWebNotif();
        })
        .catch(() => {});
    }
  }
};
