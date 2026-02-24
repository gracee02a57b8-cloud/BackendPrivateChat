package com.barsik.chat;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BarsikChat";
    private static final int PERMISSION_REQUEST_CODE = 1001;

    // Pending WebView permission request (waiting for Android runtime grant)
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Light status bar & nav bar for iOS 2026 glass theme
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().setStatusBarColor(0xFFE8EEF5);
            getWindow().setNavigationBarColor(0xFFE8EEF5);
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
        }

        // Keep screen on for calls
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Proactively request camera + microphone permissions on launch
        requestMediaPermissions();
    }

    /**
     * Request CAMERA + RECORD_AUDIO at Android runtime level.
     * This ensures that when the WebView requests getUserMedia,
     * the Android OS permission is already granted.
     */
    private void requestMediaPermissions() {
        String[] permissions = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        };

        boolean needsRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needsRequest = true;
                break;
            }
        }

        if (needsRequest) {
            Log.d(TAG, "Requesting CAMERA + RECORD_AUDIO permissions");
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        } else {
            Log.d(TAG, "CAMERA + RECORD_AUDIO already granted");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            Log.d(TAG, "Permission result: allGranted=" + allGranted);

            // If we had a pending WebView permission request, grant/deny it now
            if (pendingPermissionRequest != null) {
                if (allGranted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // Enable WebRTC and media
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " BarsikChat/1.0");

        // WebView debug logging
        WebView.setWebContentsDebuggingEnabled(true);
        Log.d(TAG, "WebView configured, loading URL: " + webView.getUrl());

        // Custom WebViewClient — error handling + SSL fallback
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                Log.d(TAG, "Page started: " + url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "Page finished: " + url);
                // Inject overscroll fix after page loads
                view.setOverScrollMode(View.OVER_SCROLL_NEVER);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.e(TAG, "WebView error: " + error.getDescription() + " URL: " + request.getUrl());

                if (request.isForMainFrame()) {
                    showErrorPage(view, "Ошибка подключения", error.getDescription().toString());
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                Log.w(TAG, "SSL error: " + error.toString());
                handler.proceed();
            }
        });

        // WebChromeClient — grant WebRTC permissions (camera, microphone)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d(TAG, "WebView permission request: " + java.util.Arrays.toString(request.getResources()));

                // Check if Android runtime permissions are already granted
                boolean hasCam = ContextCompat.checkSelfPermission(
                    MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                boolean hasMic = ContextCompat.checkSelfPermission(
                    MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

                if (hasCam && hasMic) {
                    // Already have Android permissions — grant WebView request on UI thread
                    runOnUiThread(() -> request.grant(request.getResources()));
                } else {
                    // Need to request Android permissions first, then grant WebView
                    pendingPermissionRequest = request;
                    requestMediaPermissions();
                }
            }
        });

        // Disable overscroll glow/bounce
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }

    private void showErrorPage(WebView webView, String title, String message) {
        String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>"
            + "body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;"
            + "min-height:100vh;margin:0;background:#e8eef5;color:#1a1a2e;text-align:center;padding:20px;}"
            + ".box{background:rgba(255,255,255,0.7);backdrop-filter:blur(20px);border-radius:24px;"
            + "padding:40px 30px;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.08);}"
            + "h2{font-size:22px;margin:0 0 12px;}"
            + "p{font-size:15px;color:#666;margin:0 0 24px;}"
            + "button{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;"
            + "border-radius:14px;padding:14px 36px;font-size:16px;font-weight:600;cursor:pointer;}"
            + "</style></head><body><div class='box'>"
            + "<h2>" + title + "</h2>"
            + "<p>" + message + "</p>"
            + "<button onclick='location.reload()'>Повторить</button>"
            + "</div></body></html>";
        webView.loadData(html, "text/html", "UTF-8");
    }
}
