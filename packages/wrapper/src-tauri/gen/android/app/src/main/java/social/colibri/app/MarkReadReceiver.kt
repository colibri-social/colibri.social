package social.colibri.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

private const val MARK_READ_TIMEOUT_MS = 4000

class MarkReadReceiver : BroadcastReceiver() {
	override fun onReceive(context: Context, intent: Intent) {
		val channelUri = intent.getStringExtra(EXTRA_CHANNEL_URI) ?: return
		val threadUri = intent.getStringExtra(EXTRA_THREAD_URI)
		val messageUri = intent.getStringExtra(EXTRA_MESSAGE_URI)
		val readUrl = intent.getStringExtra(EXTRA_READ_URL)
		val readToken = intent.getStringExtra(EXTRA_READ_TOKEN)
		val actionedAt = intent.getLongExtra(EXTRA_ACTIONED_AT, System.currentTimeMillis())

		NotificationTray.cancel(context, threadUri ?: channelUri)

		if (readUrl == null || readToken == null) {
			PendingMarkRead.add(context, channelUri, threadUri, messageUri, actionedAt)
			return
		}

		val pending = goAsync()
		val appContext = context.applicationContext
		Thread {
			try {
				if (!postMarkRead(readUrl, readToken)) {
					PendingMarkRead.add(appContext, channelUri, threadUri, messageUri, actionedAt)
				}
			} finally {
				pending.finish()
			}
		}.start()
	}

	private fun postMarkRead(readUrl: String, readToken: String): Boolean {
		var connection: HttpURLConnection? = null
		return try {
			connection = (URL(readUrl).openConnection() as HttpURLConnection).apply {
				requestMethod = "POST"
				connectTimeout = MARK_READ_TIMEOUT_MS
				readTimeout = MARK_READ_TIMEOUT_MS
				doOutput = true
				setRequestProperty("content-type", "application/json")
			}
			val body = JSONObject().put("token", readToken).toString().toByteArray(Charsets.UTF_8)
			connection.outputStream.use { it.write(body) }
			connection.responseCode in 200..299
		} catch (e: Exception) {
			false
		} finally {
			connection?.disconnect()
		}
	}
}
