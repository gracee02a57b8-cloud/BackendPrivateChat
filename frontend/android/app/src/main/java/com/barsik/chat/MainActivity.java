package com.barsik.chat;

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
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BarsikChat";

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
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.e(TAG, "WebView error: " + error.getDescription() + " URL: " + request.getUrl());

                // Show error page only for main frame
                if (request.isForMainFrame()) {
                    showErrorPage(view, "Ошибка подключения", error.getDescription().toString());
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                Log.w(TAG, "SSL error: " + error.toString());
                // Accept SSL errors for our server (self-signed/IP cert)
                handler.proceed();
            }
        });

        // WebChromeClient — grant WebRTC permissions
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                Log.d(TAG, "Permission request: " + java.util.Arrays.toString(request.getResources()));
                request.grant(request.getResources());
            }
        });
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
