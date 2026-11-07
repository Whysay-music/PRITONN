package com.pritonn.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.AudioAttributes;
import android.media.Image;
import android.media.ImageReader;
import android.media.RingtoneManager;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSIONS_REQUEST_CODE = 1001;
    private static final int SCREEN_CAPTURE_REQUEST_CODE = 4409;
    private static final int INSTALL_UNKNOWN_APPS_REQUEST_CODE = 4410;

    private static final String PREFS_NAME = "pritonn_native_prefs";
    private static final String PREF_NOTIF_ENABLED = "notifications_enabled";
    private static final String PREF_BG_ENABLED = "bg_mode_enabled";

    private static final String MSG_CHANNEL_ID = "pritonn_messages_v2";
    private static final String CALL_CHANNEL_ID = "pritonn_calls_v2";
    private static final String ACTIVE_CALL_CHANNEL_ID = "pritonn_active_call_v2";

    public static final int INCOMING_CALL_NOTIF_ID = 4099;
    public static final int ACTIVE_CALL_NOTIF_ID = 4100;

    private static WeakReference<MainActivity> currentInstanceRef;

    private int pendingProjectionResultCode = 0;
    private Intent pendingProjectionData = null;
    private File pendingApkInstallFile = null;
    private volatile long suppressBackUntilMs = 0L;

    private MediaProjection mediaProjection = null;
    private VirtualDisplay virtualDisplay = null;
    private ImageReader imageReader = null;
    private HandlerThread captureThread = null;
    private Handler captureHandler = null;
    private volatile long lastFrameSentAt = 0L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstanceRef = new WeakReference<>(this);

        // 1. Apply WindowInsets padding so borderless / edge-to-edge Android 15-16 phones never cover buttons
        try {
            View contentView = findViewById(android.R.id.content);
            if (contentView != null) {
                contentView.setBackgroundColor(0xFF0E1621);
                ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                    Insets insets = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
                            | WindowInsetsCompat.Type.ime()
                    );
                    v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                    return WindowInsetsCompat.CONSUMED;
                });
                ViewCompat.requestApplyInsets(contentView);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Create high-priority notification channels & request permissions
        ensureNotificationChannels();
        requestNeededPermissions();

        // 3. Configure WebView WITHOUT overwriting Capacitor's BridgeWebChromeClient!
        // Preserving BridgeWebChromeClient keeps native <input type="file"> (onShowFileChooser),
        // WebRTC camera/mic onPermissionRequest, and JS dialogs 100% functional!
        try {
            WebView webView = this.getBridge() != null ? this.getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);

                webView.addJavascriptInterface(new AndroidScreenShareBridge(), "AndroidScreenShare");
                webView.addJavascriptInterface(new AndroidAppBridge(), "AndroidAppBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Start background KeepAliveService if enabled by user
        if (isBgModeEnabledPref()) {
            startKeepAliveServiceSafe();
        }

        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;

        final String callAction = intent.getStringExtra("callAction");
        if (callAction != null && !callAction.isEmpty()) {
            final String callerId = intent.getStringExtra("callerId");
            final String callChatId = intent.getStringExtra("chatId");
            intent.removeExtra("callAction");
            intent.removeExtra("callerId");
            intent.removeExtra("chatId");

            if ("accept".equals(callAction)) {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) nm.cancel(INCOMING_CALL_NOTIF_ID);
                } catch (Throwable ignored) {}
            }

            dispatchCallActionToWeb(callAction, callerId, callChatId, 320);
        }

        final String chatId = intent.getStringExtra("openChatId");
        if (chatId != null && !chatId.isEmpty()) {
            intent.removeExtra("openChatId");
            final String safeId = chatId.replace("'", "").replace("\\", "");
            new Handler(getMainLooper()).postDelayed(
                () -> evalJs("window.__onAndroidNotificationOpen && window.__onAndroidNotificationOpen('" + safeId + "');"),
                450
            );
        }
    }

    private void dispatchCallActionToWeb(final String action, final String callerId, final String chatId, long delayMs) {
        final String safeAction = action != null ? action.replace("'", "").replace("\\", "") : "";
        final String safeCaller = callerId != null ? callerId.replace("'", "").replace("\\", "") : "";
        final String safeChat = chatId != null ? chatId.replace("'", "").replace("\\", "") : "";
        final String js =
            "(function(){var payload={action:'" + safeAction + "',callerId:'" + safeCaller + "',chatId:'" + safeChat + "'};"
            + "if(window.__onAndroidCallAction){window.__onAndroidCallAction(payload.action,payload.callerId,payload.chatId);}"
            + "else{window.__pendingAndroidCallAction=payload;}})();";
        if (delayMs > 0) {
            new Handler(getMainLooper()).postDelayed(() -> evalJs(js), delayMs);
        } else {
            evalJs(js);
        }
    }

    public static void dispatchCallActionFromReceiver(String action, String callerId, String chatId) {
        MainActivity activity = currentInstanceRef != null ? currentInstanceRef.get() : null;
        if (activity != null) {
            activity.dispatchCallActionToWeb(action, callerId, chatId, 0);
        }
    }

    public static void stopScreenShareFromReceiver(boolean notifyJs) {
        MainActivity activity = currentInstanceRef != null ? currentInstanceRef.get() : null;
        if (activity != null) {
            activity.runOnUiThread(() -> activity.stopNativeScreenCapture(notifyJs));
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep WebView JS & Socket.IO timers running when minimized or screen locked!
        if (isBgModeEnabledPref()) {
            try {
                WebView webView = this.getBridge() != null ? this.getBridge().getWebView() : null;
                if (webView != null) {
                    webView.onResume();
                    webView.resumeTimers();
                }
            } catch (Throwable ignored) {}
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingApkInstallFile != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getPackageManager().canRequestPackageInstalls()) {
                File f = pendingApkInstallFile;
                pendingApkInstallFile = null;
                launchPackageInstaller(f);
            }
        }
    }

    private SharedPreferences getNativePrefs() {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private boolean areNotificationsEnabledPref() {
        return getNativePrefs().getBoolean(PREF_NOTIF_ENABLED, true);
    }

    private boolean isBgModeEnabledPref() {
        return getNativePrefs().getBoolean(PREF_BG_ENABLED, true);
    }

    private void startKeepAliveServiceSafe() {
        try {
            Intent bgIntent = new Intent(this, KeepAliveService.class);
            ContextCompat.startForegroundService(this, bgIntent);
        } catch (Throwable ignored) {}
    }

    private void stopKeepAliveServiceSafe() {
        try {
            stopService(new Intent(this, KeepAliveService.class));
        } catch (Throwable ignored) {}
    }

    private void ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel msgChannel = new NotificationChannel(
                MSG_CHANNEL_ID,
                "Сообщения PRITONN",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Уведомления о новых сообщениях");
            msgChannel.enableVibration(true);
            nm.createNotificationChannel(msgChannel);

            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Входящие звонки PRITONN",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Уведомления о входящих звонках и голосовых чатах");
            callChannel.enableVibration(true);
            Uri ringUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringUri != null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                callChannel.setSound(ringUri, attrs);
            }
            nm.createNotificationChannel(callChannel);

            NotificationChannel activeCallChannel = new NotificationChannel(
                ACTIVE_CALL_CHANNEL_ID,
                "Текущий звонок PRITONN",
                NotificationManager.IMPORTANCE_LOW
            );
            activeCallChannel.setDescription("Управление активным звонком и демонстрацией экрана");
            activeCallChannel.setSound(null, null);
            nm.createNotificationChannel(activeCallChannel);
        }
    }

    private void requestNeededPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
            perms.add(Manifest.permission.READ_MEDIA_IMAGES);
            perms.add(Manifest.permission.READ_MEDIA_VIDEO);
            perms.add(Manifest.permission.READ_MEDIA_AUDIO);
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        List<String> missing = new ArrayList<>();
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm);
            }
        }

        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missing.toArray(new String[0]),
                PERMISSIONS_REQUEST_CODE
            );
        }
    }

    public class AndroidAppBridge {
        @JavascriptInterface
        public boolean areNotificationsEnabled() {
            return areNotificationsEnabledPref();
        }

        @JavascriptInterface
        public void setNotificationsEnabled(boolean enabled) {
            getNativePrefs().edit().putBoolean(PREF_NOTIF_ENABLED, enabled).apply();
            if (!enabled) {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        // Cancel message/call alerts while keeping foreground service notification intact
                        nm.cancelAll();
                        if (isBgModeEnabledPref()) {
                            runOnUiThread(MainActivity.this::startKeepAliveServiceSafe);
                        }
                    }
                } catch (Throwable ignored) {}
            }
        }

        @JavascriptInterface
        public boolean isBackgroundModeEnabled() {
            return isBgModeEnabledPref();
        }

        @JavascriptInterface
        public void setBackgroundModeEnabled(boolean enabled) {
            getNativePrefs().edit().putBoolean(PREF_BG_ENABLED, enabled).apply();
            runOnUiThread(() -> {
                if (enabled) {
                    startKeepAliveServiceSafe();
                } else {
                    stopKeepAliveServiceSafe();
                }
            });
        }

        @JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    try {
                        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        }
                    } catch (Throwable ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String tag, boolean isCall) {
            if (!areNotificationsEnabledPref()) return;
            try {
                ensureNotificationChannels();
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                Intent openIntent = new Intent(MainActivity.this, MainActivity.class);
                openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if (tag != null && !tag.isEmpty()) {
                    openIntent.putExtra("openChatId", tag);
                }

                int reqCode = tag != null ? Math.abs(tag.hashCode()) : 3001;
                int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    piFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pi = PendingIntent.getActivity(MainActivity.this, reqCode, openIntent, piFlags);

                String channelId = isCall ? CALL_CHANNEL_ID : MSG_CHANNEL_ID;
                NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, channelId)
                    .setSmallIcon(isCall ? android.R.drawable.sym_action_call : android.R.drawable.stat_notify_chat)
                    .setContentTitle(title != null ? title : "PRITONN")
                    .setContentText(body != null ? body : "Новое уведомление")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE);

                int notifId = isCall ? INCOMING_CALL_NOTIF_ID : (3100 + (reqCode % 5000));
                nm.notify(notifId, builder.build());
            } catch (Throwable e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void showIncomingCallNotification(String callerId, String callerName, String chatId, boolean isVideo) {
            if (!areNotificationsEnabledPref()) return;
            try {
                ensureNotificationChannels();
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    piFlags |= PendingIntent.FLAG_IMMUTABLE;
                }

                Intent openIntent = new Intent(MainActivity.this, MainActivity.class);
                openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                openIntent.putExtra("callAction", "expand");
                openIntent.putExtra("callerId", callerId != null ? callerId : "");
                openIntent.putExtra("chatId", chatId != null ? chatId : "");
                PendingIntent openPi = PendingIntent.getActivity(MainActivity.this, 4901, openIntent, piFlags);

                Intent acceptIntent = new Intent(MainActivity.this, MainActivity.class);
                acceptIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                acceptIntent.putExtra("callAction", "accept");
                acceptIntent.putExtra("callerId", callerId != null ? callerId : "");
                acceptIntent.putExtra("chatId", chatId != null ? chatId : "");
                PendingIntent acceptPi = PendingIntent.getActivity(MainActivity.this, 4902, acceptIntent, piFlags);

                Intent declineIntent = new Intent(MainActivity.this, CallActionReceiver.class);
                declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
                declineIntent.putExtra("callerId", callerId != null ? callerId : "");
                declineIntent.putExtra("chatId", chatId != null ? chatId : "");
                PendingIntent declinePi = PendingIntent.getBroadcast(MainActivity.this, 4903, declineIntent, piFlags);

                String safeName = (callerName != null && !callerName.trim().isEmpty()) ? callerName : "Собеседник";
                String subtitle = isVideo ? "Входящий видеозвонок в PRITONN" : "Входящий аудиозвонок в PRITONN";

                NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, CALL_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.sym_call_incoming)
                    .setContentTitle("📞 " + safeName)
                    .setContentText(subtitle)
                    .setContentIntent(openPi)
                    .setFullScreenIntent(openPi, true)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .addAction(android.R.drawable.sym_action_call, "Принять", acceptPi)
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Отклонить", declinePi);

                nm.notify(INCOMING_CALL_NOTIF_ID, builder.build());
            } catch (Throwable e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void showActiveCallNotification(String title, String body, boolean isScreenSharing) {
            try {
                ensureNotificationChannels();
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                // Clear incoming ring notification once active
                nm.cancel(INCOMING_CALL_NOTIF_ID);

                int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    piFlags |= PendingIntent.FLAG_IMMUTABLE;
                }

                Intent openIntent = new Intent(MainActivity.this, MainActivity.class);
                openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                openIntent.putExtra("callAction", "expand");
                PendingIntent openPi = PendingIntent.getActivity(MainActivity.this, 4911, openIntent, piFlags);

                Intent endIntent = new Intent(MainActivity.this, CallActionReceiver.class);
                endIntent.setAction(CallActionReceiver.ACTION_END_CALL);
                PendingIntent endPi = PendingIntent.getBroadcast(MainActivity.this, 4912, endIntent, piFlags);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, ACTIVE_CALL_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.sym_action_call)
                    .setContentTitle(title != null && !title.isEmpty() ? title : "Активный звонок PRITONN")
                    .setContentText(body != null && !body.isEmpty() ? body : "Нажмите, чтобы вернуться в звонок")
                    .setContentIntent(openPi)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setSilent(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                if (isScreenSharing) {
                    Intent stopScreenIntent = new Intent(MainActivity.this, CallActionReceiver.class);
                    stopScreenIntent.setAction(CallActionReceiver.ACTION_STOP_SCREEN);
                    PendingIntent stopScreenPi = PendingIntent.getBroadcast(MainActivity.this, 4913, stopScreenIntent, piFlags);
                    builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Выкл. экран", stopScreenPi);
                }

                builder.addAction(android.R.drawable.ic_menu_call, "Завершить звонок", endPi);
                nm.notify(ACTIVE_CALL_NOTIF_ID, builder.build());
            } catch (Throwable e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void cancelCallNotifications() {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(INCOMING_CALL_NOTIF_ID);
                    nm.cancel(ACTIVE_CALL_NOTIF_ID);
                }
            } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String apkUrl) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) {
                evalJs("window.__onAndroidUpdateError && window.__onAndroidUpdateError('Пустая ссылка на APK');");
                return;
            }

            new Thread(() -> {
                HttpURLConnection conn = null;
                InputStream in = null;
                FileOutputStream out = null;
                try {
                    String currentUrl = apkUrl.trim();
                    int redirects = 0;
                    while (redirects < 7) {
                        URL url = new URL(currentUrl);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(30000);
                        conn.setRequestProperty("User-Agent", "PRITONN-Android-Updater");
                        conn.setRequestProperty("Accept", "*/*");
                        conn.connect();

                        int code = conn.getResponseCode();
                        if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                            String loc = conn.getHeaderField("Location");
                            conn.disconnect();
                            if (loc == null || loc.isEmpty()) {
                                throw new Exception("Пустой редирект сервера обновлений");
                            }
                            currentUrl = new URL(url, loc).toString();
                            redirects++;
                            continue;
                        }

                        if (code != HttpURLConnection.HTTP_OK) {
                            throw new Exception("HTTP " + code);
                        }
                        break;
                    }

                    long totalBytes = conn.getContentLengthLong();
                    File apkFile = new File(getCacheDir(), "pritonn_update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }

                    in = conn.getInputStream();
                    out = new FileOutputStream(apkFile);
                    byte[] buf = new byte[16384];
                    long downloaded = 0L;
                    int lastPct = -1;
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        out.write(buf, 0, read);
                        downloaded += read;
                        if (totalBytes > 0) {
                            int pct = (int) Math.min(99L, (downloaded * 100L) / totalBytes);
                            if (pct != lastPct) {
                                lastPct = pct;
                                evalJs("window.__onAndroidUpdateProgress && window.__onAndroidUpdateProgress(" + pct + ");");
                            }
                        }
                    }
                    out.flush();
                    out.close();
                    out = null;
                    in.close();
                    in = null;

                    evalJs("window.__onAndroidUpdateProgress && window.__onAndroidUpdateProgress(100);");
                    runOnUiThread(() -> promptInstallApk(apkFile));
                } catch (Throwable err) {
                    err.printStackTrace();
                    String msg = err.getMessage() != null ? err.getMessage().replace("'", "") : "Ошибка сети";
                    evalJs("window.__onAndroidUpdateError && window.__onAndroidUpdateError('" + msg + "');");
                } finally {
                    try { if (out != null) out.close(); } catch (Throwable ignored) {}
                    try { if (in != null) in.close(); } catch (Throwable ignored) {}
                    try { if (conn != null) conn.disconnect(); } catch (Throwable ignored) {}
                }
            }, "PritonnApkUpdater").start();
        }
    }

    private void promptInstallApk(File apkFile) {
        if (apkFile == null || !apkFile.exists()) {
            evalJs("window.__onAndroidUpdateError && window.__onAndroidUpdateError('Файл обновления не найден');");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getPackageManager().canRequestPackageInstalls()) {
                pendingApkInstallFile = apkFile;
                try {
                    Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())
                    );
                    startActivityForResult(settingsIntent, INSTALL_UNKNOWN_APPS_REQUEST_CODE);
                    return;
                } catch (Throwable e) {
                    e.printStackTrace();
                }
            }
        }
        launchPackageInstaller(apkFile);
    }

    private void launchPackageInstaller(File apkFile) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(installIntent);
        } catch (Throwable e) {
            e.printStackTrace();
            String msg = e.getMessage() != null ? e.getMessage().replace("'", "") : "Ошибка запуска установщика";
            evalJs("window.__onAndroidUpdateError && window.__onAndroidUpdateError('" + msg + "');");
        }
    }

    public class AndroidScreenShareBridge {
        @JavascriptInterface
        public boolean isSupported() {
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP;
        }

        @JavascriptInterface
        public void startScreenShare() {
            runOnUiThread(() -> {
                try {
                    stopNativeScreenCapture(false);
                    MediaProjectionManager mgr = (MediaProjectionManager) getSystemService(
                        Context.MEDIA_PROJECTION_SERVICE
                    );
                    if (mgr == null) {
                        evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('unsupported');");
                        return;
                    }
                    Intent captureIntent = mgr.createScreenCaptureIntent();
                    suppressBackUntilMs = System.currentTimeMillis() + 2000L;
                    startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE);
                } catch (Exception e) {
                    e.printStackTrace();
                    evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('error');");
                }
            });
        }

        @JavascriptInterface
        public void stopScreenShare() {
            runOnUiThread(() -> stopNativeScreenCapture(false));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == INSTALL_UNKNOWN_APPS_REQUEST_CODE) {
            if (pendingApkInstallFile != null) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls()) {
                    File f = pendingApkInstallFile;
                    pendingApkInstallFile = null;
                    launchPackageInstaller(f);
                }
            }
            return;
        }
        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
            suppressBackUntilMs = System.currentTimeMillis() + 1200L;
            if (resultCode == Activity.RESULT_OK && data != null) {
                pendingProjectionResultCode = resultCode;
                pendingProjectionData = data;
                try {
                    Intent serviceIntent = new Intent(this, ScreenCaptureService.class);
                    ContextCompat.startForegroundService(this, serviceIntent);
                } catch (Exception e) {
                    e.printStackTrace();
                    evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('service_failed');");
                }
            } else {
                evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('canceled');");
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    public static void onScreenCaptureServiceStarted() {
        MainActivity activity = currentInstanceRef != null ? currentInstanceRef.get() : null;
        if (activity != null) {
            activity.runOnUiThread(activity::beginMediaProjectionCapture);
        }
    }

    public static void onScreenCaptureServiceFailed() {
        MainActivity activity = currentInstanceRef != null ? currentInstanceRef.get() : null;
        if (activity != null) {
            activity.evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('service_error');");
        }
    }

    private void beginMediaProjectionCapture() {
        if (pendingProjectionData == null || pendingProjectionResultCode != Activity.RESULT_OK) {
            evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('no_permission');");
            return;
        }

        try {
            MediaProjectionManager mgr = (MediaProjectionManager) getSystemService(
                Context.MEDIA_PROJECTION_SERVICE
            );
            if (mgr == null) {
                evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('no_manager');");
                return;
            }

            mediaProjection = mgr.getMediaProjection(pendingProjectionResultCode, pendingProjectionData);
            pendingProjectionData = null;

            if (mediaProjection == null) {
                evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('null_projection');");
                return;
            }

            DisplayMetrics metrics = getResources().getDisplayMetrics();
            int rawW = Math.max(360, metrics.widthPixels);
            int rawH = Math.max(640, metrics.heightPixels);
            int densityDpi = metrics.densityDpi;

            int maxDim = 720;
            int w = rawW;
            int h = rawH;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((float) h * maxDim / w);
                    w = maxDim;
                } else {
                    w = Math.round((float) w * maxDim / h);
                    h = maxDim;
                }
            }
            final int captureWidth = Math.max(2, (w / 2) * 2);
            final int captureHeight = Math.max(2, (h / 2) * 2);

            captureThread = new HandlerThread("PritonnScreenCapture");
            captureThread.start();
            captureHandler = new Handler(captureThread.getLooper());

            // Android 14+ requires registering a callback BEFORE createVirtualDisplay
            mediaProjection.registerCallback(
                new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        runOnUiThread(() -> stopNativeScreenCapture(true));
                    }
                },
                captureHandler
            );

            imageReader = ImageReader.newInstance(
                captureWidth,
                captureHeight,
                PixelFormat.RGBA_8888,
                2
            );

            imageReader.setOnImageAvailableListener(
                reader -> {
                    Image image = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image == null) return;

                        long now = System.currentTimeMillis();
                        if (now - lastFrameSentAt < 100L) {
                            return;
                        }
                        lastFrameSentAt = now;

                        Image.Plane[] planes = image.getPlanes();
                        if (planes == null || planes.length == 0) return;

                        ByteBuffer buffer = planes[0].getBuffer();
                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int rowPadding = rowStride - pixelStride * captureWidth;

                        int bitmapWidth = captureWidth + Math.max(0, rowPadding / pixelStride);
                        Bitmap paddedBitmap = Bitmap.createBitmap(
                            bitmapWidth,
                            captureHeight,
                            Bitmap.Config.ARGB_8888
                        );
                        paddedBitmap.copyPixelsFromBuffer(buffer);

                        Bitmap finalBitmap = paddedBitmap;
                        if (bitmapWidth != captureWidth) {
                            finalBitmap = Bitmap.createBitmap(
                                paddedBitmap,
                                0,
                                0,
                                captureWidth,
                                captureHeight
                            );
                            paddedBitmap.recycle();
                        }

                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        finalBitmap.compress(Bitmap.CompressFormat.JPEG, 60, baos);
                        finalBitmap.recycle();

                        String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                        final String dataUrl = "data:image/jpeg;base64," + b64;
                        evalJs(
                            "window.__onAndroidScreenFrame && window.__onAndroidScreenFrame('"
                                + dataUrl
                                + "');"
                        );
                    } catch (Throwable ignored) {
                    } finally {
                        if (image != null) {
                            try {
                                image.close();
                            } catch (Exception ignored) {
                            }
                        }
                    }
                },
                captureHandler
            );

            virtualDisplay = mediaProjection.createVirtualDisplay(
                "PritonnScreenShare",
                captureWidth,
                captureHeight,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                captureHandler
            );

            evalJs("window.__onAndroidScreenStarted && window.__onAndroidScreenStarted();");
        } catch (Exception e) {
            e.printStackTrace();
            stopNativeScreenCapture(false);
            evalJs("window.__onAndroidScreenError && window.__onAndroidScreenError('capture_exception');");
        }
    }

    private void stopNativeScreenCapture(boolean notifyJs) {
        try {
            if (virtualDisplay != null) {
                virtualDisplay.release();
                virtualDisplay = null;
            }
        } catch (Exception ignored) {}

        try {
            if (imageReader != null) {
                imageReader.setOnImageAvailableListener(null, null);
                imageReader.close();
                imageReader = null;
            }
        } catch (Exception ignored) {}

        try {
            if (mediaProjection != null) {
                MediaProjection proj = mediaProjection;
                mediaProjection = null;
                proj.stop();
            }
        } catch (Exception ignored) {}

        try {
            if (captureThread != null) {
                captureThread.quitSafely();
                captureThread = null;
                captureHandler = null;
            }
        } catch (Exception ignored) {}

        try {
            stopService(new Intent(this, ScreenCaptureService.class));
        } catch (Exception ignored) {}

        if (notifyJs) {
            evalJs("window.__onAndroidScreenStopped && window.__onAndroidScreenStopped();");
        }
    }

    private void evalJs(final String script) {
        runOnUiThread(() -> {
            try {
                WebView webView = this.getBridge() != null ? this.getBridge().getWebView() : null;
                if (webView != null) {
                    webView.evaluateJavascript(script, null);
                }
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onDestroy() {
        stopNativeScreenCapture(false);
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(INCOMING_CALL_NOTIF_ID);
                nm.cancel(ACTIVE_CALL_NOTIF_ID);
            }
        } catch (Throwable ignored) {}
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (System.currentTimeMillis() < suppressBackUntilMs) {
            return;
        }
        WebView webView = this.getBridge() != null ? this.getBridge().getWebView() : null;
        if (webView != null) {
            webView.evaluateJavascript(
                "if (window.onAndroidBack) { window.onAndroidBack(); } else { window.dispatchEvent(new CustomEvent('androidBackButton')); }",
                null
            );
        } else {
            super.onBackPressed();
        }
    }
}
