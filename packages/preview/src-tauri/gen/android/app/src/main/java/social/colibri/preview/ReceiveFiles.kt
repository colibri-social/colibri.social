package social.colibri.preview

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.view.ContentInfoCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class ReceiveFiles(private val context: Context, private val webView: WebView) {
  private val handler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()
  private val directory = File(context.cacheDir, DIRECTORY)

  fun attach() {
    clearStaged()
    ViewCompat.setOnReceiveContentListener(webView, MIME_TYPES, Listener())
    webView.addJavascriptInterface(Bridge(), "__colibriReceiveFiles")
  }

  private fun isMedia(type: String?): Boolean =
    type != null && (type.startsWith("image/") || type.startsWith("video/"))

  private fun typeOf(uri: Uri, fallback: String?): String? =
    context.contentResolver.getType(uri) ?: fallback

  private inner class Listener : OnReceiveContentListener {
    override fun onReceiveContent(view: android.view.View, payload: ContentInfoCompat): ContentInfoCompat? {
      val description = payload.clip.description
      val split = payload.partition { item ->
        val uri = item.uri ?: return@partition false
        val fallback = (0 until description.mimeTypeCount)
          .map { description.getMimeType(it) }
          .firstOrNull { isMedia(it) }
        isMedia(typeOf(uri, fallback))
      }
      val media = split.first
      if (media != null) {
        val fallback = (0 until description.mimeTypeCount)
          .map { description.getMimeType(it) }
          .firstOrNull { isMedia(it) }
        val uris = (0 until media.clip.itemCount).mapNotNull { media.clip.getItemAt(it).uri }
        stage(uris, fallback)
      }
      return split.second
    }
  }

  private inner class Bridge {
    @JavascriptInterface
    fun readClipboard(): Boolean {
      val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        ?: return false
      val clip: ClipData = manager.primaryClip ?: return false
      val description = clip.description
      val fallback = (0 until description.mimeTypeCount)
        .map { description.getMimeType(it) }
        .firstOrNull { isMedia(it) }
      val uris = (0 until clip.itemCount)
        .mapNotNull { clip.getItemAt(it).uri }
        .filter { isMedia(typeOf(it, fallback)) }
      if (uris.isEmpty()) return false
      stage(uris, fallback)
      return true
    }
  }

  private fun stage(uris: List<Uri>, fallback: String?) {
    executor.execute {
      val staged = JSONArray()
      directory.mkdirs()
      for (uri in uris.take(MAX_FILES)) {
        val entry = copy(uri, fallback) ?: continue
        staged.put(entry)
      }
      if (staged.length() == 0) return@execute
      val script =
        "window.dispatchEvent(new CustomEvent('colibri-receive-files', { detail: ${staged} }));"
      handler.post { webView.evaluateJavascript(script, null) }
    }
  }

  private fun copy(uri: Uri, fallback: String?): JSONObject? {
    val type = typeOf(uri, fallback) ?: return null
    if (!isMedia(type)) return null
    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(type) ?: "bin"
    val id = "${UUID.randomUUID()}.$extension"
    val target = File(directory, id)
    try {
      val input = context.contentResolver.openInputStream(uri) ?: return null
      var total = 0L
      var tooLarge = false
      input.use { stream ->
        target.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = stream.read(buffer)
            if (read < 0) break
            total += read
            if (total > MAX_BYTES) {
              tooLarge = true
              break
            }
            output.write(buffer, 0, read)
          }
        }
      }
      if (tooLarge || total == 0L) {
        target.delete()
        return null
      }
    } catch (_: Throwable) {
      target.delete()
      return null
    }
    return JSONObject()
      .put("name", displayName(uri) ?: "pasted-${System.currentTimeMillis()}.$extension")
      .put("type", type)
      .put("url", "$URL_BASE/$id")
  }

  private fun displayName(uri: Uri): String? = try {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
      ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
      ?.takeIf { it.isNotBlank() }
  } catch (_: Throwable) {
    null
  }

  private fun clearStaged() {
    executor.execute { directory.listFiles()?.forEach { it.delete() } }
  }

  companion object {
    private const val DIRECTORY = "received-files"
    private const val URL_BASE = "http://colibri-files.localhost"
    private const val MAX_FILES = 10
    private const val MAX_BYTES = 50L * 1024 * 1024
    private val MIME_TYPES = arrayOf("image/*", "video/*")
  }
}
