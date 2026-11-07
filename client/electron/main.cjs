const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  desktopCapturer,
  Tray,
  Menu,
  Notification,
  screen,
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
let callToastWindow = null;
let tray = null;
let isQuitting = false;
let backgroundModeEnabled = true;
let currentCallToastState = null; // { mode: 'incoming' | 'active', callerId, callerName, chatId, isVideo, title, body, isScreenSharing }

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

function sendCallActionToMain(action, bringToFront = false) {
  const meta = currentCallToastState || {};
  if (bringToFront && mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.flashFrame(false);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('call-notification-action', {
      action,
      callerId: meta.callerId || '',
      chatId: meta.chatId || '',
    });
  }
  if (action === 'accept' || action === 'decline' || action === 'hangup') {
    if (action !== 'accept') {
      closeCallToastWindow();
      currentCallToastState = null;
      refreshTrayMenu();
    }
  }
}

function closeCallToastWindow() {
  if (callToastWindow && !callToastWindow.isDestroyed()) {
    try {
      callToastWindow.destroy();
    } catch {}
  }
  callToastWindow = null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCallToastWindow() {
  if (!currentCallToastState) {
    closeCallToastWindow();
    return;
  }

  const state = currentCallToastState;
  const isIncoming = state.mode === 'incoming';
  const mainVisibleAndFocused =
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized() &&
    mainWindow.isFocused();

  // Show incoming call toast whenever main window isn't focused;
  // Show active call floating pill whenever screen sharing is active OR main window is minimized/hidden/unfocused!
  if (isIncoming && mainVisibleAndFocused) {
    closeCallToastWindow();
    return;
  }
  if (!isIncoming && !state.isScreenSharing && mainVisibleAndFocused) {
    closeCallToastWindow();
    return;
  }

  const width = isIncoming ? 356 : 348;
  const height = isIncoming ? 144 : state.isScreenSharing ? 118 : 92;

  let x = 40;
  let y = 40;
  try {
    const primary = screen.getPrimaryDisplay();
    const area = primary.workArea;
    x = Math.max(area.x + 12, area.x + area.width - width - 18);
    y = isIncoming
      ? Math.max(area.y + 12, area.y + area.height - height - 18)
      : area.y + 18;
  } catch {}

  if (!callToastWindow || callToastWindow.isDestroyed()) {
    callToastWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    callToastWindow.setAlwaysOnTop(true, 'screen-saver');

    callToastWindow.webContents.on('will-navigate', (event, navUrl) => {
      event.preventDefault();
      try {
        const parsed = new URL(navUrl);
        const act = parsed.searchParams.get('action');
        if (act === 'accept' || act === 'expand') {
          sendCallActionToMain(act, true);
        } else if (act === 'decline' || act === 'hangup' || act === 'stop_screen') {
          sendCallActionToMain(act, false);
        }
      } catch {}
    });
  } else {
    callToastWindow.setBounds({ x, y, width, height });
  }

  const titleText = escapeHtml(
    isIncoming ? state.callerName || 'Собеседник' : state.title || 'Активный звонок PRITONN'
  );
  const subText = escapeHtml(
    isIncoming
      ? state.isVideo
        ? 'Входящий видеозвонок • PRITONN'
        : 'Входящий звонок • PRITONN'
      : state.body || (state.isScreenSharing ? 'Идёт демонстрация экрана' : 'Звонок активен')
  );

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; font-family: 'Segoe UI', system-ui, sans-serif; }
  body { background: transparent; overflow: hidden; padding: 6px; }
  .card {
    width: 100%; height: 100%;
    background: linear-gradient(145deg, rgba(16, 25, 38, 0.97), rgba(11, 18, 28, 0.98));
    border: 1px solid ${isIncoming ? 'rgba(56, 189, 248, 0.35)' : state.isScreenSharing ? 'rgba(244, 63, 94, 0.45)' : 'rgba(52, 211, 153, 0.35)'};
    border-radius: 18px;
    padding: 12px 14px;
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 14px 34px rgba(0,0,0,0.55);
    -webkit-app-region: drag;
  }
  .top { display: flex; align-items: center; gap: 10px; cursor: pointer; -webkit-app-region: no-drag; }
  .dot {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 16px;
    background: ${isIncoming ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : state.isScreenSharing ? 'linear-gradient(135deg,#ef4444,#e11d48)' : 'linear-gradient(135deg,#10b981,#059669)'};
    box-shadow: 0 0 14px ${isIncoming ? 'rgba(14,165,233,0.45)' : state.isScreenSharing ? 'rgba(239,68,68,0.45)' : 'rgba(16,185,129,0.4)'};
  }
  .meta { min-width: 0; flex: 1; }
  .title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 11.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .actions { display: flex; gap: 7px; -webkit-app-region: no-drag; }
  a.btn {
    flex: 1; text-decoration: none; text-align: center; padding: 7px 8px;
    border-radius: 11px; font-size: 11.5px; font-weight: 700; color: #fff;
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  a.btn:hover { filter: brightness(1.12); }
  a.btn:active { transform: scale(0.97); }
  .accept { background: linear-gradient(135deg, #10b981, #059669); }
  .decline { background: linear-gradient(135deg, #ef4444, #dc2626); }
  .screen { background: rgba(244, 63, 94, 0.22); border: 1px solid rgba(244, 63, 94, 0.5); color: #fecdd3; }
  .expand { background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); color: #bae6fd; }
</style>
</head>
<body>
  <div class="card">
    <div class="top" onclick="location.href='https://pritonn.local/call?action=expand'">
      <div class="dot">${isIncoming ? '📞' : state.isScreenSharing ? '🖥️' : '🔊'}</div>
      <div class="meta">
        <div class="title">${titleText}</div>
        <div class="sub">${subText}</div>
      </div>
    </div>
    <div class="actions">
      ${
        isIncoming
          ? `<a class="btn accept" href="https://pritonn.local/call?action=accept">Принять</a>
             <a class="btn decline" href="https://pritonn.local/call?action=decline">Отклонить</a>`
          : `<a class="btn expand" href="https://pritonn.local/call?action=expand">Развернуть</a>
             ${state.isScreenSharing ? `<a class="btn screen" href="https://pritonn.local/call?action=stop_screen">Выкл. экран</a>` : ''}
             <a class="btn decline" href="https://pritonn.local/call?action=hangup">Завершить</a>`
      }
    </div>
  </div>
</body>
</html>`;

  callToastWindow
    .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    .then(() => {
      if (callToastWindow && !callToastWindow.isDestroyed()) {
        callToastWindow.showInactive();
      }
    })
    .catch(() => {});
}

function refreshTrayMenu() {
  if (!tray) return;
  const items = [
    {
      label: 'Показать PRITONN',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
  ];

  if (currentCallToastState) {
    items.push({ type: 'separator' });
    if (currentCallToastState.mode === 'incoming') {
      items.push(
        {
          label: `✅ Принять звонок (${currentCallToastState.callerName || 'Собеседник'})`,
          click: () => sendCallActionToMain('accept', true),
        },
        {
          label: '❌ Отклонить звонок',
          click: () => sendCallActionToMain('decline', false),
        }
      );
    } else {
      items.push({
        label: '🔊 Развернуть активный звонок',
        click: () => sendCallActionToMain('expand', true),
      });
      if (currentCallToastState.isScreenSharing) {
        items.push({
          label: '🖥️ Остановить демонстрацию экрана',
          click: () => sendCallActionToMain('stop_screen', false),
        });
      }
      items.push({
        label: '📴 Завершить звонок',
        click: () => sendCallActionToMain('hangup', false),
      });
    }
    items.push({ type: 'separator' });
  }

  items.push(
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
        closeCallToastWindow();
        app.quit();
      },
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/favicon.ico');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('PRITONN — работает в фоновом режиме');
    refreshTrayMenu();
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
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
    backgroundColor: '#0b121c',
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

  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
    renderCallToastWindow();
  });

  mainWindow.on('blur', () => {
    renderCallToastWindow();
  });

  mainWindow.on('minimize', () => {
    renderCallToastWindow();
  });

  mainWindow.on('hide', () => {
    renderCallToastWindow();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && backgroundModeEnabled) {
      event.preventDefault();
      mainWindow.hide();
      renderCallToastWindow();
    } else {
      isQuitting = true;
      closeCallToastWindow();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeCallToastWindow();
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
    closeCallToastWindow();
    app.quit();
  }
});

ipcMain.on('set-background-mode', (_event, enabled) => {
  backgroundModeEnabled = !!enabled;
});

// Interactive Incoming Call Notification + Overlay
ipcMain.on('show-incoming-call-notification', (_event, payload) => {
  if (!payload) return;
  currentCallToastState = {
    mode: 'incoming',
    callerId: String(payload.callerId || ''),
    callerName: String(payload.callerName || 'Собеседник'),
    chatId: String(payload.chatId || ''),
    isVideo: !!payload.isVideo,
  };
  refreshTrayMenu();
  renderCallToastWindow();

  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }

  try {
    if (Notification.isSupported()) {
      const iconPath = path.join(__dirname, '../public/favicon.ico');
      const notif = new Notification({
        title: `📞 ${currentCallToastState.callerName}`,
        body: currentCallToastState.isVideo
          ? 'Входящий видеозвонок — нажмите, чтобы ответить'
          : 'Входящий звонок — нажмите, чтобы ответить',
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        urgency: 'critical',
        silent: false,
      });
      notif.on('click', () => {
        sendCallActionToMain('expand', true);
      });
      notif.show();
    }
  } catch {}
});

// Interactive Active Call Overlay Pill + Tray Controls
ipcMain.on('show-active-call-notification', (_event, payload) => {
  if (!payload) return;
  currentCallToastState = {
    mode: 'active',
    title: String(payload.title || 'Активный звонок PRITONN'),
    body: String(payload.body || 'Звонок активен'),
    isScreenSharing: !!payload.isScreenSharing,
    chatId: String(payload.chatId || ''),
  };
  if (mainWindow) mainWindow.flashFrame(false);
  refreshTrayMenu();
  renderCallToastWindow();
});

ipcMain.on('clear-call-notifications', () => {
  currentCallToastState = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.flashFrame(false);
  }
  closeCallToastWindow();
  refreshTrayMenu();
});

// Native OS Desktop Notification for Messages & General Alerts
ipcMain.on('show-notification', (_event, payload) => {
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
ipcMain.handle('download-and-install-update', async (_event, exeUrl) => {
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
      closeCallToastWindow();
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
    closeCallToastWindow();
    app.quit();
  }
});
