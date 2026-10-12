package kz.zhank.economymodel;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowInsets;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Offline game: only bundled assets can load inside the WebView. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int OPEN_FILE = 10, SAVE_FILE = 11;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getPort() == -1 && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only document-picker URIs; navigation is restricted above.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (local(request.getUrl())) {
                    WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
                        new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (local(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (Exception e) { message("Не удалось открыть ссылку"); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (Exception e) { callback.onReceiveValue(null); fileCallback = null; message("Не удалось открыть выбор файла"); }
                return true;
            }
        });
        web.addJavascriptInterface(new ExportBridge(), "EconomyAndroid");
        web.loadUrl(ORIGIN + "/assets/index.html");
    }
    private void message(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }
    public final class ExportBridge {
        @JavascriptInterface public void saveFile(String filename, String content, String mime) {
            if (content == null || content.length() > 100 * 1024 * 1024) { message("Сохранение слишком большое"); return; }
            runOnUiThread(() -> {
                if (!local(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                if (pendingExport != null) { message("Завершите сохранение предыдущего файла"); return; }
                pendingExport = content.getBytes(StandardCharsets.UTF_8);
                String safeName = (filename == null ? "economy.json" : filename).replaceAll("[^\\p{L}\\p{N}._-]", "_");
                String type = mime != null && mime.startsWith("text/csv") ? "text/csv" : "application/json";
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(type).putExtra(Intent.EXTRA_TITLE, safeName);
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (Exception e) { pendingExport = null; message("Не удалось открыть сохранение файла"); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null
                    ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        } else if (request == SAVE_FILE) {
            final byte[] bytes = pendingExport; pendingExport = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                final Uri destination = data.getData();
                io.execute(() -> {
                    try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                        if (out == null) throw new IllegalStateException("No destination");
                        out.write(bytes); message("Файл сохранён");
                    } catch (Exception e) { message("Не удалось записать файл. Попробуйте сохранить ещё раз."); }
                });
            }
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(() => {const d=document.querySelector('dialog[open]');if(!d)return false;d.dispatchEvent(new Event('cancel',{cancelable:true}));d.close();return true;})()", value -> {
            if (!"true".equals(value)) new AlertDialog.Builder(this).setTitle("Выйти из игры?")
                    .setMessage("Ходы сохраняются на этом устройстве. Для переноса партии используйте «Сохранить».")
                    .setNegativeButton("Продолжить", null).setPositiveButton("Выйти", (d, w) -> finish()).show();
        });
    }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("EconomyAndroid"); web.destroy(); io.shutdown(); super.onDestroy();
    }
}
