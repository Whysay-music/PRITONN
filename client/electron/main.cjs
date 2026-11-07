const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  desktopCapturer,
  Tray,
  Menu,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

// Prevent Chromium from throttling Socket.IO & WebRTC timers when minimized to tray
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.pritonn.desktop');
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let backgroundModeEnabled = true;

// Enforce single instance so clicking tray / notifications focuses existing window
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/favicon.ico');
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Показать PRITONN',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Свернуть в фоновый режим (трей)',
        click: () => {
          if (mainWindow) mainWindow.hide();
        },
      },
      { type: 'separator' },
      {
        label: 'Выход из PRITONN',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip('PRITONN — работает в фоновом режиме');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('Could not initialize system tray:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 420,
    minHeight: 520,
    title: 'PRITONN',
    icon: path.join(__dirname, '../public/favicon.ico'),
    backgroundColor: '#0e1621',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  session.defaultSession.setPermissionCheckHandler(() => true);

  // Grant camera, microphone, notifications, and screen-sharing permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = [
      'media',
      'mediaKeySystem',
      'geolocation',
      'notifications',
      'midi',
      'midiSysex',
      'pointerLock',
      'fullscreen',
      'openExternal',
      'display-capture',
    ];
    if (allowedPermissions.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  // Enable getDisplayMedia for Electron screen capture
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources && sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          callback(null);
        }
      })
      .catch((err) => {
        console.warn('Failed to capture desktop sources:', err);
        callback(null);
      });
  });

  // Check if Vite Dev Server is running or if running packaged
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting && backgroundModeEnabled) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      isQuitting = true;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control handlers from frontend
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (!mainWindow) return;
  if (backgroundModeEnabled) {
    mainWindow.hide();
  } else {
    isQuitting = true;
    app.quit();
  }
});

ipcMain.on('set-background-mode', (event, enabled) => {
  backgroundModeEnabled = !!enabled;
});

// Native OS Desktop Notification for Messages & Incoming Calls
ipcMain.on('show-notification', (event, payload) => {
  try {
    if (!Notification.isSupported() || !payload) return;
    const iconPath = path.join(__dirname, '../public/favicon.ico');
    const notif = new Notification({
      title: String(payload.title || 'PRITONN'),
      body: String(payload.body || 'Новое сообщение'),
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      urgency: payload.isCall ? 'critical' : 'normal',
      silent: false,
    });
    notif.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        if (payload.chatId) {
          mainWindow.webContents.send('notification-clicked', payload.chatId);
        }
      }
    });
    notif.show();

    if (payload.isCall && mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
  } catch (err) {
    console.warn('Desktop notification error:', err);
  }
});

// Download file helper following HTTP 301/302/307/308 redirects (GitHub Releases -> CDN)
function downloadFileWithRedirects(urlStr, destPath, onProgress, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) {
      return reject(new Error('Слишком много перенаправлений при скачивании обновления'));
    }
    const client = urlStr.startsWith('https') ? https : http;
    const req = client.get(
      urlStr,
      {
        headers: {
          'User-Agent': 'PRITONN-Desktop-Updater',
          Accept: '*/*',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          res.resume();
          return resolve(
            downloadFileWithRedirects(nextUrl, destPath, onProgress, redirectsLeft - 1)
          );
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Ошибка сервера обновлений (HTTP ${res.statusCode})`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        let lastReportedPct = -1;

        const fileStream = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const pct = Math.min(99, Math.round((receivedBytes * 100) / totalBytes));
            if (pct !== lastReportedPct) {
              lastReportedPct = pct;
              onProgress(pct);
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            onProgress(100);
            resolve(destPath);
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }
    );

    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// In-App Windows Update Downloader & Detached Installer Launcher
ipcMain.handle('download-and-install-update', async (event, exeUrl) => {
  try {
    if (!exeUrl || typeof exeUrl !== 'string') {
      return { error: 'Некорректная ссылка на обновление' };
    }
    const tempInstallerPath = path.join(
      app.getPath('temp'),
      `PRITONN_Update_${Date.now()}.exe`
    );

    await downloadFileWithRedirects(exeUrl, tempInstallerPath, (pct) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', pct);
      }
    });

    // Spawn NSIS installer detached and close running app so files can be updated cleanly
    const child = spawn(tempInstallerPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    setTimeout(() => {
      isQuitting = true;
      app.quit();
    }, 600);

    return { ok: true };
  } catch (err) {
    console.error('Electron in-app update failed:', err);
    return { error: err && err.message ? err.message : 'Не удалось скачать обновление' };
  }
});

// Provide list of screens and windows with thumbnails for user selection
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 360, height: 200 },
      fetchWindowIcons: true,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      display_id: s.display_id,
    }));
  } catch (err) {
    console.error('Error fetching desktop sources:', err);
    return [];
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (isQuitting || !backgroundModeEnabled)) {
    app.quit();
  }
});
