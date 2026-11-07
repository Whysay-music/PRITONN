// Cross-platform Notifications, Call Action Controls & Background Mode Manager
// Supports Android APK (MainActivity + CallActionReceiver), Windows Electron (Call Overlay + Tray), and Web PWA (Service Worker)

export interface AppNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  chatId?: string;
  icon?: string;
  isCall?: boolean;
}

export type SystemCallActionType = 'accept' | 'decline' | 'hangup' | 'stop_screen' | 'expand';

export interface SystemCallActionPayload {
  action: SystemCallActionType;
  callerId?: string;
  chatId?: string;
}

const NOTIF_STORAGE_KEY = 'pritonn_notifications_enabled';
const SOUND_STORAGE_KEY = 'pritonn_sound_enabled';
const BG_MODE_STORAGE_KEY = 'pritonn_bg_mode_enabled';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let systemCallListenersInitialized = false;

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

const getSwRegistration = (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || isAndroidNative() || isElectronDesktop()) {
    return Promise.resolve(null);
  }
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .catch(() => null);
  }
  return swRegistrationPromise;
};

export const emitSystemCallAction = (payload: SystemCallActionPayload): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pritonn-call-action', { detail: payload }));
};

export const initSystemCallActionBridge = (): void => {
  if (typeof window === 'undefined' || systemCallListenersInitialized) return;
  systemCallListenersInitialized = true;

  // 1. Android APK native call notification / screen-share notification receiver callbacks
  (window as any).__onAndroidCallAction = (
    action: string,
    callerId?: string,
    chatId?: string
  ) => {
    if (!action) return;
    emitSystemCallAction({
      action: action as SystemCallActionType,
      callerId: callerId || '',
      chatId: chatId || '',
    });
  };

  // Consume any pending call action if Android launched/resumed activity before React mounted
  const pending = (window as any).__pendingAndroidCallAction;
  if (pending && pending.action) {
    (window as any).__pendingAndroidCallAction = null;
    setTimeout(() => {
      emitSystemCallAction({
        action: pending.action as SystemCallActionType,
        callerId: pending.callerId || '',
        chatId: pending.chatId || '',
      });
    }, 150);
  }

  // 2. Windows Electron call toast overlay & tray menu callbacks
  const electron = getElectronAPI();
  if (electron && typeof electron.onCallNotificationAction === 'function') {
    electron.onCallNotificationAction((data: any) => {
      if (data && data.action) {
        emitSystemCallAction({
          action: data.action as SystemCallActionType,
          callerId: data.callerId || '',
          chatId: data.chatId || '',
        });
      }
    });
  }

  // 3. Web Service Worker notification action buttons
  if (!isAndroidNative() && !isElectronDesktop() && 'serviceWorker' in navigator) {
    getSwRegistration().catch(() => {});
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'pritonn-call-action' && msg.action) {
        emitSystemCallAction({
          action: msg.action as SystemCallActionType,
          callerId: msg.callerId || '',
          chatId: msg.chatId || '',
        });
      } else if (msg.type === 'pritonn-open-chat' && msg.chatId) {
        window.dispatchEvent(
          new CustomEvent('pritonn-open-chat', { detail: { chatId: msg.chatId } })
        );
      }
    });
  }
};

export const onSystemCallAction = (
  callback: (payload: SystemCallActionPayload) => void
): (() => void) => {
  initSystemCallActionBridge();
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<SystemCallActionPayload>).detail;
    if (detail && detail.action) {
      callback(detail);
    }
  };
  window.addEventListener('pritonn-call-action', handler);
  return () => window.removeEventListener('pritonn-call-action', handler);
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
  initSystemCallActionBridge();
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

export const showIncomingCallSystemNotification = (params: {
  callerId: string;
  callerName: string;
  chatId?: string;
  isVideo?: boolean;
}): void => {
  if (typeof window === 'undefined') return;
  if (!areNotificationsEnabled()) return;

  const callerName = (params.callerName || 'Собеседник').slice(0, 100);
  const callerId = params.callerId || '';
  const chatId = params.chatId || '';
  const isVideo = !!params.isVideo;

  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.showIncomingCallNotification === 'function') {
    try {
      bridge.showIncomingCallNotification(callerId, callerName, chatId, isVideo);
      return;
    } catch {}
  }

  const electron = getElectronAPI();
  if (electron && typeof electron.showIncomingCallNotification === 'function') {
    try {
      electron.showIncomingCallNotification({ callerId, callerName, chatId, isVideo });
      return;
    } catch {}
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    getSwRegistration()
      .then((reg) => {
        const title = `📞 ${callerName}`;
        const body = isVideo ? 'Входящий видеозвонок в PRITONN' : 'Входящий звонок в PRITONN';
        if (reg && typeof reg.showNotification === 'function') {
          return reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'pritonn_incoming_call',
            requireInteraction: true,
            data: { isCallControl: true, callerId, chatId },
            actions: [
              { action: 'accept', title: '✅ Принять' },
              { action: 'decline', title: '❌ Отклонить' },
            ],
          } as any);
        }
        const notif = new Notification(title, { body, icon: '/favicon.ico', tag: 'pritonn_incoming_call' });
        notif.onclick = () => {
          window.focus();
          emitSystemCallAction({ action: 'expand', callerId, chatId });
          notif.close();
        };
      })
      .catch(() => {});
  }
};

export const updateActiveCallSystemNotification = (params: {
  title: string;
  body: string;
  isScreenSharing?: boolean;
  chatId?: string;
}): void => {
  if (typeof window === 'undefined') return;
  const title = (params.title || 'Активный звонок PRITONN').slice(0, 100);
  const body = (params.body || 'Нажмите, чтобы вернуться в звонок').slice(0, 180);
  const isScreenSharing = !!params.isScreenSharing;
  const chatId = params.chatId || '';

  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.showActiveCallNotification === 'function') {
    try {
      bridge.showActiveCallNotification(title, body, isScreenSharing);
      return;
    } catch {}
  }

  const electron = getElectronAPI();
  if (electron && typeof electron.showActiveCallNotification === 'function') {
    try {
      electron.showActiveCallNotification({ title, body, isScreenSharing, chatId });
      return;
    } catch {}
  }

  if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || isScreenSharing)) {
    getSwRegistration()
      .then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          const actions: any[] = [];
          if (isScreenSharing) {
            actions.push({ action: 'stop_screen', title: '🖥 Выкл. экран' });
          }
          actions.push({ action: 'hangup', title: '📴 Завершить звонок' });
          return reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'pritonn_active_call',
            silent: true,
            requireInteraction: true,
            data: { isCallControl: true, chatId },
            actions,
          } as any);
        }
      })
      .catch(() => {});
  }
};

export const clearCallSystemNotifications = (): void => {
  if (typeof window === 'undefined') return;
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.cancelCallNotifications === 'function') {
    try {
      bridge.cancelCallNotifications();
    } catch {}
  }

  const electron = getElectronAPI();
  if (electron && typeof electron.clearCallNotifications === 'function') {
    try {
      electron.clearCallNotifications();
    } catch {}
  }

  if (!isAndroidNative() && !isElectronDesktop() && 'serviceWorker' in navigator) {
    getSwRegistration()
      .then((reg) => reg?.getNotifications())
      .then((notifs) => {
        (notifs || []).forEach((n) => {
          if (n.tag === 'pritonn_incoming_call' || n.tag === 'pritonn_active_call') {
            n.close();
          }
        });
      })
      .catch(() => {});
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
