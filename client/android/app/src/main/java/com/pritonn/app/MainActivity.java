package com.pritonn.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.lang.ref.WeakReference;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSIONS_REQUEST_CODE = 1001;
    private static final int SCREEN_CAPTURE_REQUEST_CODE = 4409;

    private static WeakReference<MainActivity> currentInstanceRef;

    private int pendingProjectionResultCode = 0;
    private Intent pendingProjectionData = null;

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

        // 2. Request runtime camera, mic, media, and notification permissions
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
            }
        } catch (Exception e) {
            e.printStackTrace();
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
        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
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
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
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
