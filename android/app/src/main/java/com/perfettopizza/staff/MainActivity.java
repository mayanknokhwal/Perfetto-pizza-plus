package com.perfettopizza.staff;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    public static final String STAFF_PORTAL_URL = "https://perfetto-pizza-plus.vercel.app/staff.html";
    public static final String ORDERS_CHANNEL_ID = "orders_channel_v1";
    private static final int PERMISSION_REQUEST_CODE = 101;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Create Dedicated High-Priority Notification Channel
        createNotificationChannel();

        // 2. Request Notification Permissions for Android 13+ (API 33+)
        requestNotificationPermission();

        // 3. Stop any active order ringtone alert when staff opens the app
        stopOrderAlertService();

        // 3. Register Staff JS Interface for in-app alert control
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new StaffAudioAlertBridge(), "StaffAudioAlert");
        }

        // 4. Enforce staff-only navigation: intercept any attempted navigation to customer or admin pages
        if (bridge != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public void onPageStarted(WebView webView) {
                    if (webView != null) {
                        String currentUrl = webView.getUrl();
                        if (currentUrl != null && shouldRedirectToStaff(currentUrl)) {
                            webView.post(() -> webView.loadUrl(STAFF_PORTAL_URL));
                        }
                    }
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    if (webView != null) {
                        String currentUrl = webView.getUrl();
                        if (currentUrl != null && shouldRedirectToStaff(currentUrl)) {
                            webView.post(() -> webView.loadUrl(STAFF_PORTAL_URL));
                        }
                    }
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // App is in foreground: silence continuous alert
        stopOrderAlertService();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Tapped notification or new intent: silence continuous alert
        stopOrderAlertService();
    }

    private void stopOrderAlertService() {
        try {
            Intent stopIntent = new Intent(this, OrderAlertAudioService.class);
            stopIntent.setAction(OrderAlertAudioService.ACTION_STOP_ORDER_ALERT);
            startService(stopIntent);
        } catch (Exception ignored) { }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                        PERMISSION_REQUEST_CODE
                );
            }
        }
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

    /**
     * JavaScript Bridge interface exposed to staff.html / staff.js as `window.StaffAudioAlert`
     */
    public class StaffAudioAlertBridge {
        @JavascriptInterface
        public void stopAlert() {
            runOnUiThread(() -> stopOrderAlertService());
        }

        @JavascriptInterface
        public void triggerAlert(String orderId, String details) {
            runOnUiThread(() -> {
                try {
                    Intent alertIntent = new Intent(MainActivity.this, OrderAlertAudioService.class);
                    alertIntent.setAction(OrderAlertAudioService.ACTION_START_ORDER_ALERT);
                    alertIntent.putExtra(OrderAlertAudioService.EXTRA_ORDER_ID, orderId);
                    alertIntent.putExtra(OrderAlertAudioService.EXTRA_ORDER_DETAILS, details);
                    ContextCompat.startForegroundService(MainActivity.this, alertIntent);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public boolean isAlertPlaying() {
            return OrderAlertAudioService.isPlaying();
        }
    }

    /**
     * Inspects target URL and determines if it attempts to navigate away from the Staff Portal
     * to customer storefront (index.html, /), admin dashboard (admin.html), or other non-staff views.
     */
    private boolean shouldRedirectToStaff(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }

        // Whitelist authentication / third-party identity callbacks
        if (url.contains("msg91.com") || url.contains("phone91.com") || url.contains("firebaseapp.com") || url.contains("googleapis.com")) {
            return false;
        }

        // Lock down perfetto domain to staff.html exclusively
        if (url.contains("perfetto-pizza-plus.vercel.app")) {
            String lower = url.toLowerCase();
            if (lower.contains("admin.html") || 
                lower.contains("admin") || 
                lower.contains("index.html") || 
                lower.endsWith("perfetto-pizza-plus.vercel.app/") || 
                lower.endsWith("perfetto-pizza-plus.vercel.app") ||
                lower.contains("refund.html") ||
                lower.contains("terms.html") ||
                lower.contains("privacy.html")) {
                return true;
            }
        }
        return false;
    }
}
