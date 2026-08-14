package social.colibri.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

class MarkReadReceiver : BroadcastReceiver() {
	override fun onReceive(context: Context, intent: Intent) {
		val channelUri = intent.getStringExtra(EXTRA_CHANNEL_URI) ?: return
		val messageUri = intent.getStringExtra(EXTRA_MESSAGE_URI)
		val actionedAt = intent.getLongExtra(EXTRA_ACTIONED_AT, System.currentTimeMillis())

		PendingMarkRead.add(context, channelUri, messageUri, actionedAt)

		try {
			NotificationManagerCompat.from(context).cancel(channelUri.hashCode())
		} catch (e: SecurityException) {
		}
	}
}
