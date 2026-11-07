package com.pritonn.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class ScreenCaptureService extends Service {
    private static final String CHANNEL_ID = "pritonn_screen_share";
    private static final int NOTIFICATION_ID = 2002;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            createNotificationChannel();

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra("callAction", "expand");
            PendingIntent openPi = PendingIntent.getActivity(this, 2201, openIntent, piFlags);

            Intent stopScreenIntent = new Intent(this, CallActionReceiver.class);
            stopScreenIntent.setAction(CallActionReceiver.ACTION_STOP_SCREEN);
            PendingIntent stopScreenPi = PendingIntent.getBroadcast(this, 2202, stopScreenIntent, piFlags);

            Intent endCallIntent = new Intent(this, CallActionReceiver.class);
            endCallIntent.setAction(CallActionReceiver.ACTION_END_CALL);
            PendingIntent endCallPi = PendingIntent.getBroadcast(this, 2203, endCallIntent, piFlags);

            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentTitle("PRITONN • Идёт демонстрация экрана")
                .setContentText("Собеседники видят ваш экран. Нажмите «Выкл. экран» для остановки.")
                .setContentIntent(openPi)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Выкл. экран", stopScreenPi)
                .addAction(android.R.drawable.sym_action_call, "Завершить звонок", endCallPi)
                .build();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }

            MainActivity.onScreenCaptureServiceStarted();
        } catch (Exception e) {
            e.printStackTrace();
            MainActivity.onScreenCaptureServiceFailed();
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Демонстрация экрана PRITONN",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Уведомление во время трансляции экрана в звонке");
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
