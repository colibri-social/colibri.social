package social.colibri.app

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView

class HapticsBridge(private val context: Context, private val webView: WebView) {
  private val handler = Handler(Looper.getMainLooper())

  @JavascriptInterface
  fun perform(kind: String) {
    val constant = constantOf(kind) ?: return

    handler.post { webView.performHapticFeedback(constant) }
  }

  @JavascriptInterface
  fun enabled(): Boolean =
    Settings.System.getInt(
      context.contentResolver,
      Settings.System.HAPTIC_FEEDBACK_ENABLED,
      1
    ) != 0

  private fun constantOf(kind: String): Int? = when (kind) {
    "selection" -> HapticFeedbackConstants.CLOCK_TICK
    "impact:light", "impact:soft" -> HapticFeedbackConstants.KEYBOARD_TAP
    "impact:medium" -> HapticFeedbackConstants.CONTEXT_CLICK
    "impact:heavy", "impact:rigid" -> HapticFeedbackConstants.LONG_PRESS
    "notification:success" ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.CONFIRM
      } else {
        HapticFeedbackConstants.CONTEXT_CLICK
      }
    "notification:warning" -> HapticFeedbackConstants.LONG_PRESS
    "notification:error" ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.REJECT
      } else {
        HapticFeedbackConstants.LONG_PRESS
      }
    else -> null
  }
}
