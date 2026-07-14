package social.colibri.app

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastBars: Insets = Insets.NONE
  private var lastImeBottom: Int = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
    )
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
      lastBars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      lastImeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      injectInsets(webView, lastBars, lastImeBottom)
      insets
    }
    ViewCompat.requestApplyInsets(webView)
    for (delay in longArrayOf(250L, 750L, 1500L, 3000L)) {
      handler.postDelayed({ injectInsets(webView, lastBars, lastImeBottom) }, delay)
    }
  }

  private fun injectInsets(webView: WebView, bars: Insets, imeBottom: Int) {
    val d = webView.resources.displayMetrics.density
    webView.evaluateJavascript(
      """
      (function () {
        var s = document.documentElement.style;
        s.setProperty('--safe-area-top', '${bars.top / d}px');
        s.setProperty('--safe-area-bottom', '${bars.bottom / d}px');
        s.setProperty('--safe-area-left', '${bars.left / d}px');
        s.setProperty('--safe-area-right', '${bars.right / d}px');
        window.dispatchEvent(new CustomEvent('colibri-keyboard-inset', { detail: ${imeBottom / d} }));
      })();
      """.trimIndent(),
      null,
    )
  }
}
