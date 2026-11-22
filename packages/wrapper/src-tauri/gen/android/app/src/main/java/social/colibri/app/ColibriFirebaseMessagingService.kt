package social.colibri.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.FileProvider
import androidx.core.graphics.drawable.IconCompat
import app.tauri.plugin.JSObject
import com.bumptech.glide.Glide
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.plugin.fcm.FcmPlugin
import java.io.File
import java.io.FileOutputStream

private const val CHANNEL_ID = "colibri_messages_ping"
private const val LEGACY_CHANNEL_ID = "colibri_messages"
private const val CHANNEL_NAME = "Messages"
private const val EXTRA_MESSAGE_URIS = "social.colibri.messageUris"
private const val EXTRA_TRAY_CHANNEL_URI = "social.colibri.trayChannelUri"
private const val EXTRA_TRAY_THREAD_URI = "social.colibri.trayThreadUri"
private const val EXTRA_TRAY_READ_URL = "social.colibri.trayReadUrl"
private const val EXTRA_TRAY_READ_TOKEN = "social.colibri.trayReadToken"
private const val ATTACHMENT_MAX_WIDTH_DP = 450
private const val ATTACHMENT_MAX_HEIGHT_DP = 300
private const val CACHED_IMAGE_TTL_MS = 7L * 24 * 60 * 60 * 1000

object NotificationTray {
	@Volatile var activityResumed = false

	@JvmStatic private external fun nativeIsLive(): Boolean

	fun isLive(): Boolean =
		activityResumed &&
			try {
				nativeIsLive()
			} catch (e: UnsatisfiedLinkError) {
				false
			}

	fun notificationId(channelUri: String, threadUri: String?): Int = (threadUri ?: channelUri).hashCode()

	fun cancel(context: Context, target: String) {
		try {
			NotificationManagerCompat.from(context).cancel(target.hashCode())
		} catch (e: SecurityException) {
		}
	}

	@JvmStatic
	fun dismiss(context: Context, targets: Array<String>) {
		for (target in targets) cancel(context, target)
	}

	fun ensureChannel(context: Context) {
		if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
		val manager = context.getSystemService(NotificationManager::class.java) ?: return
		if (manager.getNotificationChannel(LEGACY_CHANNEL_ID) != null) {
			manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
		}
		if (manager.getNotificationChannel(CHANNEL_ID) != null) return
		val sound = Uri.parse("android.resource://${context.packageName}/${R.raw.ping}")
		val attributes =
			AudioAttributes.Builder()
				.setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
				.setUsage(AudioAttributes.USAGE_NOTIFICATION)
				.build()
		manager.createNotificationChannel(
			NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
				setSound(sound, attributes)
			},
		)
	}
}

private class TrayEntry(
	val message: NotificationCompat.MessagingStyle.Message,
	val uri: String,
)

private fun rkeyOf(uri: String): String = uri.substringAfterLast('/')

class ColibriFirebaseMessagingService : FirebaseMessagingService() {
	override fun onNewToken(token: String) {
		val plugin = FcmPlugin.instance
		if (plugin != null) {
			plugin.trigger("token-refresh", JSObject().put("token", token))
		} else {
			getSharedPreferences("fcm_plugin", Context.MODE_PRIVATE)
				.edit()
				.putString("fcm_token", token)
				.apply()
		}
	}

	override fun onMessageReceived(message: RemoteMessage) {
		val data = message.data
		val channelUri = data["channelUri"] ?: data["channel"] ?: return
		val threadUri = data["threadUri"]?.takeIf { it.isNotEmpty() }
		val messageUri = data["messageUri"]?.takeIf { it.isNotEmpty() }

		when (data["type"]) {
			"read" -> {
				markTrayRead(channelUri, threadUri, data["through"]?.takeIf { it.isNotEmpty() })
				return
			}
			"delete" -> {
				if (messageUri != null) removeMessageFromTray(messageUri)
				return
			}
			"edit" -> {
				val body = data["body"]
				if (messageUri != null && body != null) editMessageInTray(messageUri, body)
				return
			}
		}

		if (NotificationTray.isLive()) return

		val body = data["body"] ?: ""
		val deepLink = notificationDeepLink(channelUri, threadUri, messageUri) ?: data["deepLink"]
		val spaceName = data["spaceName"] ?: data["communityName"]
		val conversationTitle = data["subtitle"]?.takeIf { it.isNotEmpty() } ?: spaceName
		val spaceAvatarUrl = data["spaceAvatarUrl"] ?: data["communityAvatarUrl"]
		val authorName = data["authorName"] ?: data["title"] ?: "Someone"
		val authorAvatarUrl = data["authorAvatarUrl"]
		val imageUrl = data["imageUrl"]
		val readUrl = data["readUrl"]?.takeIf { it.isNotEmpty() }
		val readToken = data["readToken"]?.takeIf { it.isNotEmpty() }

		NotificationTray.ensureChannel(this)

		Thread {
			val spaceAvatar = spaceAvatarUrl?.let(::fetchAvatar)
			val authorAvatar = authorAvatarUrl?.let { fetchAvatar(it, circle = true) }
			val attachmentImage = imageUrl?.let(::fetchAttachment)
			showNotification(
				channelUri,
				threadUri,
				messageUri,
				authorName,
				body,
				deepLink,
				conversationTitle,
				spaceAvatar,
				authorAvatar,
				attachmentImage,
				readUrl,
				readToken,
			)
		}.start()
	}

	private fun notificationDeepLink(
		channelUri: String,
		threadUri: String?,
		messageUri: String?,
	): String? =
		try {
			Uri.Builder()
				.scheme("social.colibri")
				.path("/notification")
				.appendQueryParameter("channel", channelUri)
				.apply {
					threadUri?.let { appendQueryParameter("thread", it) }
					messageUri?.let { appendQueryParameter("message", it) }
				}
				.build()
				.toString()
		} catch (e: Exception) {
			null
		}

	private fun fetchBitmap(
		url: String,
		width: Int,
		height: Int,
		circle: Boolean = false,
	): Bitmap? =
		try {
			Glide.with(applicationContext)
				.asBitmap()
				.load(url)
				.let { if (circle) it.circleCrop() else it.centerInside() }
				.submit(width, height)
				.get()
		} catch (e: Exception) {
			null
		}

	private fun fetchAvatar(url: String, circle: Boolean = false): Bitmap? =
		fetchBitmap(
			url,
			resources.getDimensionPixelSize(android.R.dimen.notification_large_icon_width),
			resources.getDimensionPixelSize(android.R.dimen.notification_large_icon_height),
			circle,
		)

	private fun fetchAttachment(url: String): Bitmap? =
		fetchBitmap(url, dpToPx(ATTACHMENT_MAX_WIDTH_DP), dpToPx(ATTACHMENT_MAX_HEIGHT_DP))

	private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

	private fun cacheImageUri(bitmap: Bitmap): Uri? =
		try {
			val dir = File(cacheDir, "notification_images").apply { mkdirs() }
			val cutoff = System.currentTimeMillis() - CACHED_IMAGE_TTL_MS
			dir.listFiles()?.forEach { if (it.lastModified() < cutoff) it.delete() }
			val file = File(dir, "notif_${System.currentTimeMillis()}.jpg")
			FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
			FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
		} catch (e: Exception) {
			null
		}

	private fun markReadAction(
		channelUri: String,
		threadUri: String?,
		messageUri: String?,
		readUrl: String?,
		readToken: String?,
		notificationId: Int,
	): NotificationCompat.Action {
		val intent =
			Intent(this, MarkReadReceiver::class.java).apply {
				putExtra(EXTRA_CHANNEL_URI, channelUri)
				threadUri?.let { putExtra(EXTRA_THREAD_URI, it) }
				messageUri?.let { putExtra(EXTRA_MESSAGE_URI, it) }
				readUrl?.let { putExtra(EXTRA_READ_URL, it) }
				readToken?.let { putExtra(EXTRA_READ_TOKEN, it) }
				putExtra(EXTRA_ACTIONED_AT, System.currentTimeMillis())
			}
		val pending =
			PendingIntent.getBroadcast(
				this,
				notificationId,
				intent,
				PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
			)

		return NotificationCompat.Action.Builder(
			IconCompat.createWithResource(this, R.drawable.ic_notification_mark_read),
			getString(R.string.notification_action_mark_read),
			pending,
		)
			.setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
			.setShowsUserInterface(false)
			.build()
	}

	private fun trayBuilder(
		style: NotificationCompat.MessagingStyle,
		uris: ArrayList<String>,
		channelUri: String,
		threadUri: String?,
		readUrl: String?,
		readToken: String?,
		notificationId: Int,
	): NotificationCompat.Builder =
		NotificationCompat.Builder(this, CHANNEL_ID)
			.setSmallIcon(R.drawable.ic_notification)
			.setStyle(style)
			.setAutoCancel(true)
			.setPriority(NotificationCompat.PRIORITY_HIGH)
			.setCategory(NotificationCompat.CATEGORY_MESSAGE)
			.addExtras(
				Bundle().apply {
					putStringArrayList(EXTRA_MESSAGE_URIS, uris)
					putString(EXTRA_TRAY_CHANNEL_URI, channelUri)
					threadUri?.let { putString(EXTRA_TRAY_THREAD_URI, it) }
					readUrl?.let { putString(EXTRA_TRAY_READ_URL, it) }
					readToken?.let { putString(EXTRA_TRAY_READ_TOKEN, it) }
				},
			)
			.addAction(
				markReadAction(
					channelUri,
					threadUri,
					uris.lastOrNull { it.isNotEmpty() },
					readUrl,
					readToken,
					notificationId,
				),
			)

	private fun post(notificationId: Int, notification: Notification) {
		try {
			NotificationManagerCompat.from(this).notify(notificationId, notification)
		} catch (e: SecurityException) {
		}
	}

	private fun showNotification(
		channelUri: String,
		threadUri: String?,
		messageUri: String?,
		authorName: String,
		body: String,
		deepLink: String?,
		conversationTitle: String?,
		spaceAvatar: Bitmap?,
		authorAvatar: Bitmap?,
		attachmentImage: Bitmap?,
		readUrl: String?,
		readToken: String?,
	) {
		val notificationId = NotificationTray.notificationId(channelUri, threadUri)
		val manager = getSystemService(NotificationManager::class.java)

		val existing =
			manager
				?.activeNotifications
				?.firstOrNull { it.id == notificationId }
				?.notification

		val existingUris =
			existing?.extras?.getStringArrayList(EXTRA_MESSAGE_URIS) ?: arrayListOf()
		if (messageUri != null && existingUris.contains(messageUri)) return

		val existingStyle =
			existing?.let { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it) }

		val sender =
			Person.Builder().setName(authorName).apply {
				authorAvatar?.let { setIcon(IconCompat.createWithBitmap(it)) }
			}.build()

		val messagingStyle =
			(existingStyle ?: NotificationCompat.MessagingStyle(Person.Builder().setName("You").build()))
				.also { style ->
					conversationTitle?.let {
						style.conversationTitle = it
						style.isGroupConversation = true
					}
					val message =
						NotificationCompat.MessagingStyle.Message(body, System.currentTimeMillis(), sender)
					attachmentImage?.let(::cacheImageUri)?.let { message.setData("image/jpeg", it) }
					style.addMessage(message)
				}

		val uris = ArrayList(existingUris).apply { add(messageUri ?: "") }

		val contentIntent =
			deepLink?.let {
				val intent =
					Intent(Intent.ACTION_VIEW, Uri.parse(it)).apply {
						setPackage(packageName)
					}
				PendingIntent.getActivity(
					this,
					notificationId,
					intent,
					PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
				)
			}

		val builder =
			trayBuilder(messagingStyle, uris, channelUri, threadUri, readUrl, readToken, notificationId)

		spaceAvatar?.let { builder.setLargeIcon(it) }
		contentIntent?.let { builder.setContentIntent(it) }

		post(notificationId, builder.build())
	}

	private fun activeTray(): List<StatusBarNotification> =
		getSystemService(NotificationManager::class.java)?.activeNotifications?.toList() ?: emptyList()

	private fun rewriteTray(
		active: StatusBarNotification,
		transform: (List<TrayEntry>) -> List<TrayEntry>,
	) {
		val notification = active.notification
		val extras = notification.extras
		val uris = extras.getStringArrayList(EXTRA_MESSAGE_URIS) ?: return
		val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification)
		val messages = style?.messages
		if (style == null || messages == null || messages.size != uris.size) {
			NotificationManagerCompat.from(this).cancel(active.id)
			return
		}

		val kept = transform(messages.mapIndexed { i, message -> TrayEntry(message, uris[i]) })
		if (kept.isEmpty()) {
			NotificationManagerCompat.from(this).cancel(active.id)
			return
		}

		val rebuilt = NotificationCompat.MessagingStyle(style.user)
		style.conversationTitle?.let {
			rebuilt.conversationTitle = it
			rebuilt.isGroupConversation = true
		}
		kept.forEach { rebuilt.addMessage(it.message) }

		val channelUri = extras.getString(EXTRA_TRAY_CHANNEL_URI)
		if (channelUri == null) {
			NotificationManagerCompat.from(this).cancel(active.id)
			return
		}

		val builder =
			trayBuilder(
				rebuilt,
				ArrayList(kept.map { it.uri }),
				channelUri,
				extras.getString(EXTRA_TRAY_THREAD_URI),
				extras.getString(EXTRA_TRAY_READ_URL),
				extras.getString(EXTRA_TRAY_READ_TOKEN),
				active.id,
			)
				.setOnlyAlertOnce(true)
				.setSilent(true)

		notification.contentIntent?.let { builder.setContentIntent(it) }
		notification.getLargeIcon()?.let { builder.setLargeIcon(it) }

		post(active.id, builder.build())
	}

	private fun copyMessage(
		message: NotificationCompat.MessagingStyle.Message,
		text: CharSequence?,
	): NotificationCompat.MessagingStyle.Message {
		val copy = NotificationCompat.MessagingStyle.Message(text ?: "", message.timestamp, message.person)
		val mimeType = message.dataMimeType
		val dataUri = message.dataUri
		if (mimeType != null && dataUri != null) copy.setData(mimeType, dataUri)
		return copy
	}

	private fun markTrayRead(channelUri: String, threadUri: String?, through: String?) {
		val target = threadUri ?: channelUri
		if (through == null) {
			NotificationTray.cancel(this, target)
			return
		}
		val active = activeTray().firstOrNull { it.id == target.hashCode() } ?: return
		rewriteTray(active) { entries ->
			entries.filter { it.uri.isNotEmpty() && rkeyOf(it.uri) > through }
		}
	}

	private fun findMessage(messageUri: String): StatusBarNotification? =
		activeTray().firstOrNull {
			it.notification.extras.getStringArrayList(EXTRA_MESSAGE_URIS)?.contains(messageUri) == true
		}

	private fun removeMessageFromTray(messageUri: String) {
		val active = findMessage(messageUri) ?: return
		rewriteTray(active) { entries -> entries.filter { it.uri != messageUri } }
	}

	private fun editMessageInTray(messageUri: String, body: String) {
		val active = findMessage(messageUri) ?: return
		rewriteTray(active) { entries ->
			entries.map {
				if (it.uri == messageUri) TrayEntry(copyMessage(it.message, body), it.uri) else it
			}
		}
	}
}
