import { API_BASE_URL, APP_VERSION, GITHUB_REPO } from '../config';

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  apkUrl: string;
  winSetupUrl: string;
  winPortableUrl: string;
  releasePageUrl: string;
}

const normalizeVer = (v?: string | null): string => {
  if (!v) return '0.0.0';
  return v.trim().replace(/^v/i, '');
};

export const compareVersions = (a: string, b: string): number => {
  const pa = normalizeVer(a)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVer(b)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
};

export const getCurrentPlatform = (): 'android' | 'electron' | 'web' => {
  if (typeof window === 'undefined') return 'web';
  if ((window as any).AndroidAppBridge || (window as any).Capacitor?.isNativePlatform?.()) {
    return 'android';
  }
  if ((window as any).electronAPI) {
    return 'electron';
  }
  return 'web';
};

export const checkForAppUpdate = async (): Promise<AppUpdateInfo> => {
  const currentVersion = APP_VERSION;
  let latestVersion = currentVersion;
  let releaseNotes = '';
  let apkUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  let winSetupUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  let winPortableUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  let releasePageUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // 1. Check GitHub Releases API first (authoritative source for APK & Windows EXE assets)
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const tagVer = normalizeVer(ghData.tag_name || ghData.name || '');
      if (tagVer && tagVer !== '0.0.0') {
        latestVersion = tagVer;
        releaseNotes = ghData.body || '';
        releasePageUrl = ghData.html_url || releasePageUrl;

        const assets: any[] = Array.isArray(ghData.assets) ? ghData.assets : [];
        const apkAsset = assets.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'));
        const setupAsset = assets.find(
          (a) =>
            typeof a.name === 'string' &&
            a.name.endsWith('.exe') &&
            a.name.toLowerCase().includes('setup')
        );
        const anyExeAsset = assets.find(
          (a) => typeof a.name === 'string' && a.name.endsWith('.exe')
        );
        const portableAsset = assets.find(
          (a) =>
            typeof a.name === 'string' &&
            a.name.endsWith('.exe') &&
            a.name.toLowerCase().includes('portable')
        );

        apkUrl =
          apkAsset?.browser_download_url ||
          `https://github.com/${GITHUB_REPO}/releases/download/v${tagVer}/PRITONN_v${tagVer}.apk`;
        winSetupUrl =
          setupAsset?.browser_download_url ||
          anyExeAsset?.browser_download_url ||
          `https://github.com/${GITHUB_REPO}/releases/download/v${tagVer}/PRITONN_Setup_${tagVer}.exe`;
        winPortableUrl =
          portableAsset?.browser_download_url ||
          winSetupUrl;
      }
    }
  } catch {
    // Fallback to backend version endpoint below
  }

  // 2. Also query our backend `/api/app-version` in case a newer server version was deployed
  try {
    const apiRes = await fetch(`${API_BASE_URL}/api/app-version`, { cache: 'no-store' });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      const serverVer = normalizeVer(apiData.version);
      if (serverVer && compareVersions(serverVer, latestVersion) > 0) {
        latestVersion = serverVer;
        if (apiData.releaseNotes) releaseNotes = apiData.releaseNotes;
        if (apiData.apkUrl) apkUrl = apiData.apkUrl;
        if (apiData.winSetupUrl) winSetupUrl = apiData.winSetupUrl;
        if (apiData.releasePageUrl) releasePageUrl = apiData.releasePageUrl;
      }
    }
  } catch {}

  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseNotes,
    apkUrl,
    winSetupUrl,
    winPortableUrl,
    releasePageUrl,
  };
};

export const installAppUpdate = async (
  info: AppUpdateInfo,
  onProgress?: (percent: number, statusText: string) => void
): Promise<void> => {
  const platform = getCurrentPlatform();

  // 1. Android APK Native In-App Downloader + Package Installer
  if (platform === 'android') {
    const bridge = (window as any).AndroidAppBridge;
    if (bridge && typeof bridge.downloadAndInstallApk === 'function') {
      return new Promise<void>((resolve, reject) => {
        (window as any).__onAndroidUpdateProgress = (pct: number) => {
          onProgress?.(pct, pct >= 100 ? 'Запуск установщика Android...' : `Скачивание APK: ${pct}%`);
          if (pct >= 100) {
            resolve();
          }
        };
        (window as any).__onAndroidUpdateError = (errMsg: string) => {
          reject(new Error(errMsg || 'Ошибка загрузки обновления Android'));
        };
        onProgress?.(1, 'Подготовка загрузки APK...');
        bridge.downloadAndInstallApk(info.apkUrl);
      });
    }
    window.open(info.apkUrl, '_blank');
    return;
  }

  // 2. Windows PC Electron In-App Downloader + Automatic Installer Launch
  if (platform === 'electron') {
    const electron = (window as any).electronAPI;
    if (electron && typeof electron.downloadAndInstallUpdate === 'function') {
      let unsubscribe: (() => void) | undefined;
      if (typeof electron.onUpdateProgress === 'function') {
        unsubscribe = electron.onUpdateProgress((pct: number) => {
          onProgress?.(
            pct,
            pct >= 100 ? 'Запуск установщика Windows...' : `Скачивание обновления: ${pct}%`
          );
        });
      }
      try {
        onProgress?.(2, 'Подключение к серверу обновлений...');
        const res = await electron.downloadAndInstallUpdate(info.winSetupUrl);
        if (res && res.error) {
          throw new Error(res.error);
        }
        onProgress?.(100, 'Обновление скачано! Перезапуск...');
      } finally {
        if (unsubscribe) unsubscribe();
      }
      return;
    }
    window.open(info.winSetupUrl, '_blank');
    return;
  }

  // 3. Web Browser — Clear caches & reload latest bundle from server
  onProgress?.(50, 'Очистка кэша и обновление веб-версии...');
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  onProgress?.(100, 'Перезагрузка...');
  window.location.reload();
};
