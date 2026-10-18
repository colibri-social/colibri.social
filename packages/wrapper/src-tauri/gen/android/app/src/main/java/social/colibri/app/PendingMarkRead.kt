package social.colibri.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

const val EXTRA_CHANNEL_URI = "social.colibri.channelUri"
const val EXTRA_THREAD_URI = "social.colibri.threadUri"
const val EXTRA_MESSAGE_URI = "social.colibri.messageUri"
const val EXTRA_READ_URL = "social.colibri.readUrl"
const val EXTRA_READ_TOKEN = "social.colibri.readToken"
const val EXTRA_ACTIONED_AT = "social.colibri.actionedAt"

object PendingMarkRead {
	private const val PREFS_NAME = "colibri_notification_actions"
	private const val KEY = "pendingMarkRead"

	private val lock = Any()

	private fun prefs(context: Context) =
		context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

	private fun read(context: Context): JSONArray =
		try {
			JSONArray(prefs(context).getString(KEY, "[]") ?: "[]")
		} catch (e: Exception) {
			JSONArray()
		}

	private fun write(context: Context, entries: JSONArray) {
		prefs(context).edit().putString(KEY, entries.toString()).commit()
	}

	private fun targetOf(entry: JSONObject): String =
		entry.optString("threadUri").ifEmpty { entry.optString("channelUri") }

	private fun without(entries: JSONArray, matches: (JSONObject) -> Boolean): JSONArray {
		val kept = JSONArray()
		for (i in 0 until entries.length()) {
			val entry = entries.optJSONObject(i) ?: continue
			if (matches(entry)) continue
			kept.put(entry)
		}
		return kept
	}

	fun add(
		context: Context,
		channelUri: String,
		threadUri: String?,
		messageUri: String?,
		actionedAt: Long,
	) {
		synchronized(lock) {
			val entry =
				JSONObject().apply {
					put("channelUri", channelUri)
					if (threadUri != null) put("threadUri", threadUri)
					if (messageUri != null) put("messageUri", messageUri)
					put("actionedAt", actionedAt)
				}
			val target = threadUri ?: channelUri
			write(context, without(read(context)) { targetOf(it) == target }.put(entry))
		}
	}

	fun peek(context: Context): String = synchronized(lock) { read(context).toString() }

	fun ack(context: Context, uri: String) {
		synchronized(lock) {
			write(
				context,
				without(read(context)) {
					it.optString("channelUri") == uri || it.optString("threadUri") == uri
				},
			)
		}
	}
}
