package com.focusforge.study;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
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
import org.json.JSONArray;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

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
    private static final String KEY_ALIAS = "focusforge_gemini_v1";
    private static final String OPENAI_ALIAS = "focusforge_openai_v1";
    private static final String KEY_PREFS = "focusforge_secure";
    private WebView webView;
    private ValueCallbackCompat pendingFiles;
    private String pendingBackup;
    private TextToSpeech narrator;
    private boolean narratorReady;
    private String pendingNarration;
    private final AtomicBoolean openAIWorking = new AtomicBoolean(false);

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
        private SecretKey key(String alias, boolean create) throws Exception {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            SecretKey existing = (SecretKey) store.getKey(alias, null);
            if (existing != null || !create) return existing;
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256).build());
            return generator.generateKey();
        }

        private boolean saveSecret(String alias, String preference, String value) {
            if (value == null || value.length() < 8 || value.length() > 512) return false;
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key(alias, true));
                String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
                String encrypted = Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
                return getSharedPreferences(KEY_PREFS, Context.MODE_PRIVATE).edit()
                        .putString(preference, iv + ":" + encrypted).commit();
            } catch (Exception e) { return false; }
        }

        private String loadSecret(String alias, String preference) {
            String saved = getSharedPreferences(KEY_PREFS, Context.MODE_PRIVATE).getString(preference, "");
            if (saved == null || saved.isEmpty()) return "";
            try {
                String[] parts = saved.split(":", 2);
                if (parts.length != 2) return "";
                SecretKey secret = key(alias, false);
                if (secret == null) return "";
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, secret,
                        new GCMParameterSpec(128, Base64.decode(parts[0], Base64.DEFAULT)));
                return new String(cipher.doFinal(Base64.decode(parts[1], Base64.DEFAULT)), StandardCharsets.UTF_8);
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public boolean saveGeminiKey(String value) { return saveSecret(KEY_ALIAS, "gemini", value); }
        @JavascriptInterface public String loadGeminiKey() { return loadSecret(KEY_ALIAS, "gemini"); }
        @JavascriptInterface public boolean saveOpenAIKey(String value) { return saveSecret(OPENAI_ALIAS, "openai", value); }
        // JavaScript can only ask whether a key exists; the secret never returns to the WebView.
        @JavascriptInterface public boolean hasOpenAIKey() { return !loadSecret(OPENAI_ALIAS, "openai").isEmpty(); }
        @JavascriptInterface public void clearOpenAIKey() {
            getSharedPreferences(KEY_PREFS, Context.MODE_PRIVATE).edit().remove("openai").commit();
        }

        @JavascriptInterface
        public void requestOpenAI(String id, String prompt) {
            if (id == null || !id.matches("[a-zA-Z0-9-]{1,80}") || prompt == null || prompt.length() > 24000) return;
            if (!openAIWorking.compareAndSet(false, true)) { deliverOpenAI(id, false, "Ya hay otra consulta en curso."); return; }
            new Thread(() -> {
                try {
                    String secret = loadSecret(OPENAI_ALIAS, "openai");
                    if (secret.isEmpty()) throw new IOException("Configura tu clave de la API de OpenAI en Ajustes.");
                    HttpURLConnection conn = (HttpURLConnection) new URL("https://api.openai.com/v1/responses").openConnection();
                    try {
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(70000);
                        conn.setRequestMethod("POST");
                        conn.setDoOutput(true);
                        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                        conn.setRequestProperty("Authorization", "Bearer " + secret);
                        JSONObject body = new JSONObject();
                        body.put("model", "gpt-4.1-mini");
                        body.put("input", prompt);
                        body.put("store", false);
                        body.put("max_output_tokens", 3500);
                        try (OutputStream out = conn.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                        int status = conn.getResponseCode();
                        if (status != 200) throw new IOException("OpenAI respondió " + status + ". Comprueba la clave, el saldo o los límites de tu API.");
                        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                        try (InputStream in = conn.getInputStream()) {
                            byte[] chunk = new byte[8192]; int n;
                            while ((n = in.read(chunk)) != -1) {
                                if (bytes.size() + n > 350000) throw new IOException("Respuesta demasiado grande.");
                                bytes.write(chunk, 0, n);
                            }
                        }
                        JSONObject result = new JSONObject(bytes.toString("UTF-8"));
                        JSONArray output = result.optJSONArray("output");
                        StringBuilder answer = new StringBuilder();
                        if (output != null) for (int i = 0; i < output.length(); i++) {
                            JSONArray parts = output.optJSONObject(i) == null ? null : output.optJSONObject(i).optJSONArray("content");
                            if (parts != null) for (int j = 0; j < parts.length(); j++) {
                                JSONObject part = parts.optJSONObject(j);
                                if (part != null && "output_text".equals(part.optString("type"))) answer.append(part.optString("text"));
                            }
                        }
                        if (answer.length() == 0) throw new IOException("OpenAI no devolvió texto utilizable.");
                        deliverOpenAI(id, true, answer.toString());
                    } finally { conn.disconnect(); }
                } catch (Exception e) { deliverOpenAI(id, false, e.getMessage() == null ? "No se pudo consultar OpenAI." : e.getMessage()); }
                finally { openAIWorking.set(false); }
            }, "focusforge-openai").start();
        }

        private void deliverOpenAI(String id, boolean ok, String message) {
            runOnUiThread(() -> {
                if (webView != null) webView.evaluateJavascript(
                        "window.FocusForgeOpenAIResult(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(message) + ")", null);
            });
        }

        @JavascriptInterface
        public void clearGeminiKey() {
            getSharedPreferences(KEY_PREFS, Context.MODE_PRIVATE).edit().remove("gemini").commit();
        }

        @JavascriptInterface
        public String readSpreadsheet(String base64) {
            if (base64 == null || base64.length() > 3_000_000) return "ERROR: archivo XLSX demasiado grande (máximo 2 MB).";
            try { return SpreadsheetReader.read(Base64.decode(base64, Base64.DEFAULT)); }
            catch (Exception e) { return "ERROR: no se pudo leer este XLSX. Exporta la hoja a CSV e inténtalo otra vez."; }
        }

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
            if (json == null || json.getBytes(StandardCharsets.UTF_8).length > 5_000_000) {
                runOnUiThread(() -> show("Copia demasiado grande (máximo 5 MB)."));
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
