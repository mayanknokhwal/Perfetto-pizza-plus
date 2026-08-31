package com.perfettopizza.staff;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class OrderAlertAudioService extends Service {

    private static final String TAG = "OrderAlertAudioService";
    public static final String CHANNEL_ID = "orders_channel_v1";
    public static final int NOTIFICATION_ID = 94145;

    public static final String ACTION_START_ORDER_ALERT = "com.perfettopizza.staff.ACTION_START_ORDER_ALERT";
    public static final String ACTION_STOP_ORDER_ALERT = "com.perfettopizza.staff.ACTION_STOP_ORDER_ALERT";
    public static final String EXTRA_ORDER_ID = "extra_order_id";
    public static final String EXTRA_ORDER_DETAILS = "extra_order_details";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private static boolean isAlertPlaying = false;

    public static boolean isPlaying() {
        return isAlertPlaying;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START_ORDER_ALERT.equals(action)) {
                String orderId = intent.getStringExtra(EXTRA_ORDER_ID);
                String details = intent.getStringExtra(EXTRA_ORDER_DETAILS);
                startContinuousOrderAlert(orderId, details);
            } else if (ACTION_STOP_ORDER_ALERT.equals(action)) {
                stopContinuousOrderAlert();
            }
        }
        return START_NOT_STICKY;
    }

    private void startContinuousOrderAlert(String orderId, String details) {
        Log.d(TAG, "Starting continuous order alert for order: " + orderId);
        isAlertPlaying = true;

        // 1. Acquire WakeLock to turn on/keep alive screen
        acquireWakeLock();

        // 2. Start Foreground Notification with high priority & lock screen actions
        Notification notification = buildAlertNotification(orderId, details);
        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service: " + e.getMessage());
        }

        // 3. Start Continuous Looping Ringtone Sound (respecting phone silent/vibrate mode)
        playLoopingAudio();

        // 4. Start Continuous Repeating Vibration (respecting silent mode)
        startRepeatingVibration();
    }

    private void playLoopingAudio() {
        try {
            if (mediaPlayer != null) {
                try { mediaPlayer.stop(); mediaPlayer.release(); } catch (Exception ignored) {}
                mediaPlayer = null;
            }

            // Strictly respect phone's Silent and Vibrate modes (like incoming call)
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int ringerMode = audioManager.getRingerMode();
                if (ringerMode == AudioManager.RINGER_MODE_SILENT || ringerMode == AudioManager.RINGER_MODE_VIBRATE) {
                    Log.d(TAG, "Phone is in Silent or Vibrate mode. Suppressing audio playback.");
                    return;
                }
            }

            Uri soundUri = null;
            try {
                int resId = getResources().getIdentifier("order_alert", "raw", getPackageName());
                if (resId != 0) {
                    soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
                }
            } catch (Exception ignored) {}

            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(getApplicationContext(), soundUri);

            // Ringtone / Notification stream configuration
            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            mediaPlayer.setAudioAttributes(attributes);
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_RING);
            mediaPlayer.setLooping(false);
            mediaPlayer.setVolume(1.0f, 1.0f);

            // Stop service and release resources when single full track completes
            mediaPlayer.setOnCompletionListener(mp -> {
                Log.d(TAG, "Order alert audio completed playing single full track. Stopping alert service.");
                stopContinuousOrderAlert();
            });

            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Error initializing alert audio: " + e.getMessage());
        }
    }

    private void startRepeatingVibration() {
        try {
            // Suppress vibration only if phone is in strict SILENT mode
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null && audioManager.getRingerMode() == AudioManager.RINGER_MODE_SILENT) {
                Log.d(TAG, "Phone is in Silent mode. Suppressing vibration.");
                return;
            }

            long[] pattern = { 0, 800, 400, 800, 400, 800, 1000 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    vibrator = vibratorManager.getDefaultVibrator();
                }
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    VibrationEffect effect = VibrationEffect.createWaveform(pattern, -1); // -1 = play once without looping
                    vibrator.vibrate(effect);
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration: " + e.getMessage());
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                try {
                    wakeLock = pm.newWakeLock(
                            PowerManager.FULL_WAKE_LOCK |
                            PowerManager.ACQUIRE_CAUSES_WAKEUP |
                            PowerManager.ON_AFTER_RELEASE,
                            "PerfettoStaff:OrderAlertWakeLock"
                    );
                } catch (Exception fallback) {
                    wakeLock = pm.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK |
                            PowerManager.ACQUIRE_CAUSES_WAKEUP |
                            PowerManager.ON_AFTER_RELEASE,
                            "PerfettoStaff:OrderAlertWakeLock"
                    );
                }
                // 3 minutes max safety timeout
                wakeLock.acquire(3 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring wakeLock: " + e.getMessage());
        }
    }

    private Notification buildAlertNotification(String orderId, String details) {
        String displayId = (orderId != null && !orderId.trim().isEmpty()) ? "#" + orderId : "Incoming";
        String contentText = (details != null && !details.trim().isEmpty())
                ? details
                : "New order received! Tap to view order in kitchen queue.";

        // Tap Notification: Open MainActivity and Stop Alarm
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setAction(Intent.ACTION_VIEW);
        openIntent.putExtra(EXTRA_ORDER_ID, orderId);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingOpenIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action Button: Silence Alarm directly from notification drawer
        Intent silenceIntent = new Intent(this, OrderAlertAudioService.class);
        silenceIntent.setAction(ACTION_STOP_ORDER_ALERT);
        PendingIntent pendingSilenceIntent = PendingIntent.getService(
                this,
                1,
                silenceIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("🍕 NEW ORDER RECEIVED (" + displayId + ")")
                .setContentText(contentText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText + "\n\nAlert will continue ringing until opened or silenced."))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(pendingOpenIntent)
                .setFullScreenIntent(pendingOpenIntent, true)
                .addAction(android.R.drawable.ic_menu_view, "Open Kitchen Queue", pendingOpenIntent)
                .addAction(android.R.drawable.ic_lock_silent_mode, "Silence Alarm", pendingSilenceIntent);

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            NotificationChannel ordersChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "New Order Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ordersChannel.setDescription("Incoming Customer Order Notifications with Custom Sound and Vibration");
            ordersChannel.enableLights(true);
            ordersChannel.setLightColor(0xFFFF6B00);
            ordersChannel.enableVibration(true);
            ordersChannel.setVibrationPattern(new long[]{ 0, 800, 400, 800, 400, 800, 1000 });
            ordersChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            try {
                int soundResId = getResources().getIdentifier("order_alert", "raw", getPackageName());
                if (soundResId != 0) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .build();
                    Uri customSoundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
                    ordersChannel.setSound(customSoundUri, audioAttributes);
                }
            } catch (Exception ignored) {}

            if (manager != null) {
                manager.createNotificationChannel(ordersChannel);
            }
        }
    }

    public void stopContinuousOrderAlert() {
        Log.d(TAG, "Stopping continuous order alert");
        isAlertPlaying = false;

        // 1. Stop Audio
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping mediaPlayer: " + e.getMessage());
        }

        // 2. Stop Vibration
        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping vibrator: " + e.getMessage());
        }

        // 3. Release WakeLock
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing wakeLock: " + e.getMessage());
        }

        // 4. Stop Foreground Service & Remove Ongoing Notification
        try {
            stopForeground(true);
            stopSelf();
        } catch (Exception e) {
            Log.e(TAG, "Error stopping foreground service: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        stopContinuousOrderAlert();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
