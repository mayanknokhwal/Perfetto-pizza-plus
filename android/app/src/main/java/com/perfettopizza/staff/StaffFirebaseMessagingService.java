package com.perfettopizza.staff;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class StaffFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "StaffFCMService";
    public static final String ORDERS_CHANNEL_ID = "orders_channel_v1";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                        ORDERS_CHANNEL_ID,
                        "New Order Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Incoming Customer Order Notifications with Custom Sound and Vibration");
                channel.enableLights(true);
                channel.setLightColor(0xFFFF6B00);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{ 0, 800, 400, 800, 400, 800, 1000 });
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

                try {
                    int soundResId = getResources().getIdentifier("order_alert", "raw", getPackageName());
                    if (soundResId != 0) {
                        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                .build();
                        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
                        channel.setSound(soundUri, audioAttributes);
                    }
                } catch (Exception ignored) {}

                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        // 0. Acquire temporary PowerManager WakeLock to wake up the screen immediately
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            try {
                wakeLock = pm.newWakeLock(
                        PowerManager.FULL_WAKE_LOCK |
                        PowerManager.ACQUIRE_CAUSES_WAKEUP |
                        PowerManager.ON_AFTER_RELEASE,
                        "PerfettoStaff:FCMWakeLock"
                );
                wakeLock.acquire(15 * 1000L); // 15s wake lock
            } catch (Exception e) {
                Log.w(TAG, "WakeLock acquisition notice: " + e.getMessage());
            }
        }

        String orderId = "";
        String details = "";
        boolean isOrderAlert = true; // By default all staff notifications are critical order alerts

        // 1. Check Data Payload
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            if (data.containsKey("orderId")) {
                orderId = data.get("orderId");
            } else if (data.containsKey("id")) {
                orderId = data.get("id");
            }

            if (data.containsKey("details")) {
                details = data.get("details");
            } else if (data.containsKey("customerName") && (data.containsKey("totalAmount") || data.containsKey("total"))) {
                String amt = data.containsKey("totalAmount") ? data.get("totalAmount") : data.get("total");
                details = data.get("customerName") + " • ₹" + amt;
            } else if (data.containsKey("message")) {
                details = data.get("message");
            }
        }

        // 2. Check Notification Payload fallback
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            if (details.isEmpty() && body != null) {
                details = body;
            }
            if (orderId.isEmpty() && title != null && title.contains("#")) {
                int hashIdx = title.indexOf("#");
                orderId = title.substring(hashIdx + 1).replaceAll("[^0-9]", "");
            }
        }

        if (orderId.isEmpty()) {
            orderId = "New";
        }

        // 3. Launch Continuous Looping Audio Foreground Service with FullScreenIntent
        if (isOrderAlert) {
            Intent alertIntent = new Intent(this, OrderAlertAudioService.class);
            alertIntent.setAction(OrderAlertAudioService.ACTION_START_ORDER_ALERT);
            alertIntent.putExtra(OrderAlertAudioService.EXTRA_ORDER_ID, orderId);
            alertIntent.putExtra(OrderAlertAudioService.EXTRA_ORDER_DETAILS, details);

            try {
                ContextCompat.startForegroundService(this, alertIntent);
                Log.d(TAG, "Successfully started OrderAlertAudioService for order: " + orderId);
            } catch (Exception e) {
                Log.e(TAG, "Failed to start OrderAlertAudioService: " + e.getMessage());
            }
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Registration Token: " + token);
    }
}
