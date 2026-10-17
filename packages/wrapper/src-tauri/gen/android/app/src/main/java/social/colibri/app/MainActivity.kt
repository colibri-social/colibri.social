package social.colibri.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : TauriActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastBars: Insets = Insets.NONE
  private var lastImeBottom: Int = -1
  private var committedImeBottom: Int = -1
  private var imeAnimating = false
  private var imeFrom: Int = 0
  private var barsScriptHandler: ScriptHandler? = null
  private var askedForNotifications = false
  private var pendingOpenCall = false
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    WebView.setWebContentsDebuggingEnabled(true)
    super.onCreate(savedInstanceState)
    pendingOpenCall = intent?.action == CallService.ACTION_OPEN_CALL
  }

  override fun onResume() {
    super.onResume()
    webView?.evaluateJavascript(
      "window.dispatchEvent(new CustomEvent('colibri-mark-read-pending'));",
      null
    )
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (intent.action == CallService.ACTION_OPEN_CALL) CallEvents.dispatch("open")
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    CallEvents.attach(webView)
    webView.addJavascriptInterface(CallBridge(), "__colibriCall")
    webView.addJavascriptInterface(WindowBridge(), "__colibriWindow")
    webView.addJavascriptInterface(
      NotificationActionsBridge(),
      "__colibriNotificationActions"
    )
    ReceiveFiles(this, webView).attach()
    if (pendingOpenCall) {
      pendingOpenCall = false
      handler.postDelayed({ CallEvents.dispatch("open") }, 1500L)
    }
    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      lastBars = bars
      registerBarsScript(webView, bars)
      lastImeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (!imeAnimating && lastImeBottom != committedImeBottom) {
        dispatchKeyboard(webView, lastImeBottom)
      }
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(webView, object :
      WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
      override fun onPrepare(animation: WindowInsetsAnimationCompat) {
        if ((animation.typeMask and WindowInsetsCompat.Type.ime()) == 0) return
        imeAnimating = true
        imeFrom = maxOf(committedImeBottom, 0)
      }

      override fun onStart(
        animation: WindowInsetsAnimationCompat,
        bounds: WindowInsetsAnimationCompat.BoundsCompat
      ): WindowInsetsAnimationCompat.BoundsCompat {
        if ((animation.typeMask and WindowInsetsCompat.Type.ime()) != 0) {
          dispatchKeyboardStart(webView, imeFrom, maxOf(lastImeBottom, 0))
        }
        return bounds
      }

      override fun onProgress(
        insets: WindowInsetsCompat,
        runningAnimations: MutableList<WindowInsetsAnimationCompat>
      ): WindowInsetsCompat {
        if (!imeAnimating) return insets
        val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        dispatchKeyboardProgress(webView, imeBottom)
        return insets
      }

      override fun onEnd(animation: WindowInsetsAnimationCompat) {
        if ((animation.typeMask and WindowInsetsCompat.Type.ime()) == 0) return
        imeAnimating = false
        dispatchKeyboard(webView, maxOf(lastImeBottom, 0))
      }
    })
    ViewCompat.requestApplyInsets(webView)
    for (delay in longArrayOf(250L, 750L, 1500L, 3000L)) {
      handler.postDelayed({
        registerBarsScript(webView, lastBars)
        if (!imeAnimating) dispatchKeyboard(webView, maxOf(lastImeBottom, 0))
      }, delay)
    }
  }

  private fun px(webView: WebView, value: Int): Float =
    value / webView.resources.displayMetrics.density

  private fun dispatchKeyboardStart(webView: WebView, from: Int, to: Int) {
    val safeBottom = if (to > 0) 0f else px(webView, lastBars.bottom)
    webView.evaluateJavascript(
      "document.documentElement.style.setProperty('--safe-area-bottom', '${safeBottom}px');" +
        "window.dispatchEvent(new CustomEvent('colibri-safe-area-change'));" +
        "window.dispatchEvent(new CustomEvent('colibri-keyboard-progress', { detail: { phase: 'start', from: ${px(webView, from)}, to: ${px(webView, to)} } }));",
      null
    )
  }

  private fun dispatchKeyboardProgress(webView: WebView, imeBottom: Int) {
    webView.evaluateJavascript(
      "window.dispatchEvent(new CustomEvent('colibri-keyboard-progress', { detail: { phase: 'progress', inset: ${px(webView, imeBottom)} } }));",
      null
    )
  }

  private fun dispatchKeyboard(webView: WebView, imeBottom: Int) {
    committedImeBottom = imeBottom
    val bottom = px(webView, imeBottom)
    val safeBottom = if (imeBottom > 0) 0f else px(webView, lastBars.bottom)
    webView.evaluateJavascript(
      "document.documentElement.style.setProperty('--keyboard-inset', '${bottom}px');" +
        "document.documentElement.style.setProperty('--safe-area-bottom', '${safeBottom}px');" +
        "window.dispatchEvent(new CustomEvent('colibri-safe-area-change'));" +
        "window.dispatchEvent(new CustomEvent('colibri-keyboard-inset', { detail: $bottom }));",
      null
    )
  }

  private fun registerBarsScript(webView: WebView, bars: Insets) {
    val script = """
      (function () {
        var s = document.documentElement.style;
        s.setProperty('--safe-area-top', '${px(webView, bars.top)}px');
        s.setProperty('--safe-area-bottom', '${if (lastImeBottom > 0) 0f else px(webView, bars.bottom)}px');
        s.setProperty('--safe-area-left', '${px(webView, bars.left)}px');
        s.setProperty('--safe-area-right', '${px(webView, bars.right)}px');
        window.dispatchEvent(new CustomEvent('colibri-safe-area-change'));
      })();
    """.trimIndent()
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      barsScriptHandler?.remove()
      barsScriptHandler = WebViewCompat.addDocumentStartJavaScript(webView, script, setOf("*"))
    }
    webView.evaluateJavascript(script, null)
  }

  private fun requestNotificationsOnce() {
    if (askedForNotifications || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    askedForNotifications = true
    if (
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
    ) return
    ActivityCompat.requestPermissions(
      this,
      arrayOf(Manifest.permission.POST_NOTIFICATIONS),
      REQUEST_NOTIFICATIONS
    )
  }

  private fun applyLightBars(light: Boolean) {
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.isAppearanceLightStatusBars = light
    controller.isAppearanceLightNavigationBars = light
  }

  private inner class WindowBridge {
    @JavascriptInterface
    fun setLightBars(light: Boolean) {
      handler.post { applyLightBars(light) }
    }
  }

  private inner class NotificationActionsBridge {
    @JavascriptInterface
    fun pendingMarkRead(): String = PendingMarkRead.peek(this@MainActivity)

    @JavascriptInterface
    fun ackMarkRead(channelUri: String) {
      PendingMarkRead.ack(this@MainActivity, channelUri)
    }
  }

  private inner class CallBridge {
    @JavascriptInterface
    fun start(json: String) {
      handler.post {
        requestNotificationsOnce()
        CallService.start(this@MainActivity, json)
      }
    }

    @JavascriptInterface
    fun update(json: String) {
      handler.post { CallService.start(this@MainActivity, json) }
    }

    @JavascriptInterface
    fun stop() {
      handler.post { CallService.stop(this@MainActivity) }
    }

    @JavascriptInterface
    fun hasSound(name: String): Boolean = CallSounds.has(this@MainActivity, name)

    @JavascriptInterface
    fun storeSound(name: String, base64: String) {
      CallSounds.store(this@MainActivity, name, base64)
    }

    @JavascriptInterface
    fun playSound(name: String) {
      handler.post { CallSounds.play(this@MainActivity, name) }
    }
  }

  companion object {
    private const val REQUEST_NOTIFICATIONS = 4102
  }
}
