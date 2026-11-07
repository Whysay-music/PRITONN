package com.pritonn.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_DECLINE_CALL = "com.pritonn.app.ACTION_DECLINE_CALL";
    public static final String ACTION_END_CALL = "com.pritonn.app.ACTION_END_CALL";
    public static final String ACTION_STOP_SCREEN = "com.pritonn.app.ACTION_STOP_SCREEN";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        String callerId = intent.getStringExtra("callerId");
        String chatId = intent.getStringExtra("chatId");

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (ACTION_DECLINE_CALL.equals(action)) {
            if (nm != null) {
                nm.cancel(MainActivity.INCOMING_CALL_NOTIF_ID);
            }
            MainActivity.dispatchCallActionFromReceiver("decline", callerId, chatId);
        } else if (ACTION_END_CALL.equals(action)) {
            if (nm != null) {
                nm.cancel(MainActivity.INCOMING_CALL_NOTIF_ID);
                nm.cancel(MainActivity.ACTIVE_CALL_NOTIF_ID);
            }
            MainActivity.stopScreenShareFromReceiver(true);
            MainActivity.dispatchCallActionFromReceiver("hangup", callerId, chatId);
        } else if (ACTION_STOP_SCREEN.equals(action)) {
            MainActivity.stopScreenShareFromReceiver(true);
            MainActivity.dispatchCallActionFromReceiver("stop_screen", callerId, chatId);
        }
    }
}
