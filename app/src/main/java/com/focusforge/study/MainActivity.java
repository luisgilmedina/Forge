package com.focusforge.study;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * FocusForge OPPO: native Android shell for the bundled, offline-capable study interface.
 * Uses the HTTPS appassets origin so localStorage, secure-context Web APIs and CORS work.
 * It does not monitor, lock or control other applications.
 */
public final class MainActivity extends Activity {
    private static final int OPEN_FILES = 40;
    private static final int SAVE_BACKUP = 41;
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String HOME_URL = "https://" + LOCAL_HOST + "/assets/www/index.html";
    private WebView webView;
    private ValueCallbackCompat pendingFiles;
    private String pendingBackup;
    private TextToSpeech narrator;
    private boolean narratorReady;
    private String pendingNarration;

    private interface ValueCallbackCompat { void deliver(Uri[] uris); }

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(17, 31, 51));
        getWindow().setNavigationBarColor(Color.rgb(17, 31, 51));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(17, 31, 51));
        setContentView(webView);
        fitSystemBars();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // The bundled app is written in JavaScript.
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        final WebViewAssetLoader localFiles = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localFiles.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && LOCAL_HOST.equalsIgnoreCase(uri.getHost())
                        && uri.getPath() != null && uri.getPath().startsWith("/assets/www/")) {
                    return false;
                }
                // All external links open outside our privileged app WebView.
                if ("https".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException e) { show("No hay navegador para abrir este enlace."); }
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                    android.webkit.ValueCallback<Uri[]> callback,
                    WebChromeClient.FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.deliver(null);
                pendingFiles = callback::onReceiveValue;
                Intent picker = params.createIntent();
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(picker, OPEN_FILES);
                    return true;
                } catch (ActivityNotFoundException e) {
                    pendingFiles.deliver(null);
                    pendingFiles = null;
                    show("No se encontró una aplicación para seleccionar archivos.");
                    return false;
                }
            }
        });
        // Bound only to a packaged page. No outside page is allowed inside this WebView.
        webView.addJavascriptInterface(new BackupInterface(), "FocusForgeAndroid");
        webView.loadUrl(HOME_URL);
    }

    private void fitSystemBars() {
        webView.setOnApplyWindowInsetsListener((View v, WindowInsets insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets b = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(),
                        insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(),
                        insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
    }

    private final class BackupInterface {
        @JavascriptInterface
        public void speakLesson(String script) {
            if (script == null || script.isEmpty() || script.length() > 3200) return;
            runOnUiThread(() -> {
                pendingNarration = script;
                if (narratorReady && narrator != null) {
                    narrator.speak(pendingNarration, TextToSpeech.QUEUE_FLUSH, null, "focusforge-lesson");
                    pendingNarration = null;
                } else if (narrator == null) {
                    narrator = new TextToSpeech(MainActivity.this, status -> runOnUiThread(() -> {
                        if (status != TextToSpeech.SUCCESS || narrator == null) {
                            pendingNarration = null;
                            if (narrator != null) { narrator.shutdown(); narrator = null; }
                            narratorReady = false;
                            show("No hay voz de Android disponible.");
                            return;
                        }
                        int language = narrator.setLanguage(new Locale("es", "ES"));
                        if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
                            pendingNarration = null;
                            narrator.shutdown();
                            narrator = null;
                            narratorReady = false;
                            show("Instala una voz en español en los ajustes de Android.");
                            return;
                        }
                        narratorReady = true;
                        if (pendingNarration != null) {
                            narrator.speak(pendingNarration, TextToSpeech.QUEUE_FLUSH, null, "focusforge-lesson");
                            pendingNarration = null;
                        }
                    }));
                }
            });
        }

        @JavascriptInterface
        public void stopLesson() {
            runOnUiThread(() -> {
                pendingNarration = null;
                if (narrator != null) narrator.stop();
            });
        }

        @JavascriptInterface
        public void saveBackup(String json) {
            if (json == null || json.length() > 2_500_000) {
                runOnUiThread(() -> show("Copia demasiado grande (máximo 2,5 MB)."));
                return;
            }
            try {
                JSONObject data = new JSONObject(json);
                if (!"focusforge-0.1".equals(data.optString("format"))) {
                    runOnUiThread(() -> show("El formato de la copia no es válido."));
                    return;
                }
            } catch (Exception e) {
                runOnUiThread(() -> show("No se ha podido preparar la copia."));
                return;
            }
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType("application/json");
                save.putExtra(Intent.EXTRA_TITLE,
                    "focusforge-copia-" + new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT)
                        .format(new Date()) + ".json");
                try { startActivityForResult(save, SAVE_BACKUP); }
                catch (ActivityNotFoundException e) {
                    pendingBackup = null;
                    show("No existe una aplicación para guardar el archivo.");
                }
            });
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OPEN_FILES) {
            if (pendingFiles != null) {
                pendingFiles.deliver(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                pendingFiles = null;
            }
        } else if (requestCode == SAVE_BACKUP) {
            String backup = pendingBackup;
            pendingBackup = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || backup == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "w")) {
                if (out == null) throw new IOException("No se abrió el destino.");
                out.write(backup.getBytes(StandardCharsets.UTF_8));
                show("Copia guardada.");
            } catch (IOException | SecurityException e) {
                show("Error al guardar la copia. Prueba otra carpeta.");
            }
        }
    }

    private void show(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingFiles != null) pendingFiles.deliver(null);
        pendingFiles = null;
        pendingBackup = null;
        if (webView != null) {
            webView.removeJavascriptInterface("FocusForgeAndroid");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        pendingNarration = null;
        if (narrator != null) { narrator.stop(); narrator.shutdown(); narrator = null; }
        super.onDestroy();
    }
}
