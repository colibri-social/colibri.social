package social.colibri.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

const val EXTRA_CHANNEL_URI = "social.colibri.channelUri"
const val EXTRA_MESSAGE_URI = "social.colibri.messageUri"
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

	private fun withoutChannel(entries: JSONArray, channelUri: String): JSONArray {
		val kept = JSONArray()
		for (i in 0 until entries.length()) {
			val entry = entries.optJSONObject(i) ?: continue
			if (entry.optString("channelUri") == channelUri) continue
			kept.put(entry)
		}
		return kept
	}

	fun add(context: Context, channelUri: String, messageUri: String?, actionedAt: Long) {
		synchronized(lock) {
			val entry =
				JSONObject().apply {
					put("channelUri", channelUri)
					if (messageUri != null) put("messageUri", messageUri)
					put("actionedAt", actionedAt)
				}
			write(context, withoutChannel(read(context), channelUri).put(entry))
		}
	}

	fun peek(context: Context): String = synchronized(lock) { read(context).toString() }

	fun ack(context: Context, channelUri: String) {
		synchronized(lock) { write(context, withoutChannel(read(context), channelUri)) }
	}
}
