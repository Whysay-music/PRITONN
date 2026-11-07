package com.pritonn.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class KeepAliveService extends Service {
    private static final String CHANNEL_ID = "pritonn_bg_service";
    private static final int NOTIFICATION_ID = 2001;

    private PowerManager.WakeLock wakeLock = null;
    private WifiManager.WifiLock wifiLock = null;

    @Override
    public void onCreate() {
        super.onCreate();
        acquireLocks();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            createNotificationChannel();

            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, piFlags);

            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle("PRITONN в сети")
                .setContentText("Фоновый режим активен — приём сообщений и звонков")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .build();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable e) {
            e.printStackTrace();
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    private void acquireLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pritonn:bg_wakelock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Throwable ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wifiLock == null) {
                int lockMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                    : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiLock = wm.createWifiLock(lockMode, "pritonn:bg_wifilock");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        } catch (Throwable ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            wakeLock = null;
        } catch (Throwable ignored) {}

        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
            wifiLock = null;
        } catch (Throwable ignored) {}
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Фоновая работа PRITONN",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Позволяет получать сообщения и звонки в фоновом режиме");
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
