package social.colibri.preview

import android.webkit.WebView
import java.lang.ref.WeakReference

object CallEvents {
  private var webView: WeakReference<WebView>? = null

  fun attach(view: WebView) {
    webView = WeakReference(view)
  }

  fun dispatch(action: String): Boolean {
    val view = webView?.get() ?: return false
    view.post {
      view.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('colibri-call-action', { detail: '$action' }));",
        null
      )
    }
    return true
  }
}
