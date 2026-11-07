// Universal Mobile / Android Native Screen Share Bridge for PRITONN

interface AndroidScreenShareBridge {
  isSupported?: () => boolean;
  startScreenShare?: () => void;
  stopScreenShare?: () => void;
}

declare global {
  interface Window {
    AndroidScreenShare?: AndroidScreenShareBridge;
    __onAndroidScreenStarted?: () => void;
    __onAndroidScreenFrame?: (dataUrl: string) => void;
    __onAndroidScreenStopped?: () => void;
    __onAndroidScreenError?: (reason?: string) => void;
  }
}

export interface MobileScreenShareSession {
  stream: MediaStream;
  isNativeAndroid: boolean;
  stop: () => void;
}

/**
 * Checks whether the native Android APK MediaProjection bridge is available.
 */
export function hasNativeAndroidScreenShare(): boolean {
  try {
    return !!(window.AndroidScreenShare && typeof window.AndroidScreenShare.startScreenShare === 'function');
  } catch {
    return false;
  }
}

/**
 * Unconditionally stops any active native Android MediaProjection screen capture.
 */
export function forceStopNativeAndroidScreenShare(): void {
  try {
    window.__onAndroidScreenStarted = undefined;
    window.__onAndroidScreenFrame = undefined;
    window.__onAndroidScreenStopped = undefined;
    window.__onAndroidScreenError = undefined;
    window.AndroidScreenShare?.stopScreenShare?.();
  } catch {}
}

/**
 * Starts native Android system screen capture (via MediaProjection ForegroundService bridge)
 * when running inside the PRITONN Android APK, returning a live Canvas MediaStream + frame callback.
 */
export function startNativeAndroidScreenShare(
  onFrame: (jpegDataUrl: string) => void,
  onRemoteStop: () => void
): Promise<MobileScreenShareSession> {
  return new Promise((resolve, reject) => {
    if (!window.AndroidScreenShare || typeof window.AndroidScreenShare.startScreenShare !== 'function') {
      reject(new Error('AndroidScreenShare bridge unavailable'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0e1621';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const stream = canvas.captureStream ? canvas.captureStream(15) : new MediaStream();
    let settled = false;
    let active = true;
    const img = new Image();

    const cleanupCallbacks = () => {
      active = false;
      window.__onAndroidScreenStarted = undefined;
      window.__onAndroidScreenFrame = undefined;
      window.__onAndroidScreenStopped = undefined;
      window.__onAndroidScreenError = undefined;
    };

    const stopTracks = () => {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    };

    const stop = () => {
      if (!active) return;
      cleanupCallbacks();
      try {
        window.AndroidScreenShare?.stopScreenShare?.();
      } catch {}
      stopTracks();
    };

    window.__onAndroidScreenStarted = () => {
      if (!settled) {
        settled = true;
        resolve({
          stream,
          isNativeAndroid: true,
          stop,
        });
      }
    };

    window.__onAndroidScreenFrame = (dataUrl: string) => {
      if (!active || !dataUrl) return;
      if (!settled) {
        settled = true;
        resolve({
          stream,
          isNativeAndroid: true,
          stop,
        });
      }
      onFrame(dataUrl);
      img.onload = () => {
        if (!active || !ctx) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      };
      img.src = dataUrl;
    };

    window.__onAndroidScreenStopped = () => {
      cleanupCallbacks();
      stopTracks();
      if (!settled) {
        settled = true;
        reject(new Error('canceled'));
      } else {
        onRemoteStop();
      }
    };

    window.__onAndroidScreenError = (reason?: string) => {
      cleanupCallbacks();
      stopTracks();
      if (!settled) {
        settled = true;
        reject(new Error(reason || 'canceled'));
      } else {
        onRemoteStop();
      }
    };

    try {
      window.AndroidScreenShare.startScreenShare();
    } catch (err) {
      cleanupCallbacks();
      stopTracks();
      reject(err);
    }
  });
}
