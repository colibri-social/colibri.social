package social.colibri.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.FileProvider
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.io.File
import java.io.FileOutputStream
import java.net.URL

private const val CHANNEL_ID = "colibri_messages"
private const val CHANNEL_NAME = "Messages"
private const val EXTRA_MESSAGE_URIS = "social.colibri.messageUris"

class ColibriFirebaseMessagingService : FirebaseMessagingService() {
	override fun onMessageReceived(message: RemoteMessage) {
		val data = message.data
		val channelUri = data["channelUri"] ?: return
		val messageUri = data["messageUri"]

		if (data["type"] == "delete") {
			if (messageUri != null) removeMessageFromTray(channelUri, messageUri)
			return
		}

		val body = data["body"] ?: ""
		val deepLink = data["deepLink"]
		val communityName = data["communityName"]
		val communityAvatarUrl = data["communityAvatarUrl"]
		val authorName = data["authorName"] ?: "Someone"
		val authorAvatarUrl = data["authorAvatarUrl"]
		val imageUrl = data["imageUrl"]

		ensureNotificationChannel()

		// onMessageReceived runs on the main thread; fetching the avatars and
		// the attachment image is network I/O and must not block it.
		Thread {
			val communityAvatar = communityAvatarUrl?.let(::fetchBitmap)
			val authorAvatar = authorAvatarUrl?.let(::fetchBitmap)
			val attachmentImage = imageUrl?.let(::fetchBitmap)
			showNotification(
				channelUri,
				messageUri,
				authorName,
				body,
				deepLink,
				communityName,
				communityAvatar,
				authorAvatar,
				attachmentImage,
			)
		}.start()
	}

	private fun ensureNotificationChannel() {
		if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
		val manager = getSystemService(NotificationManager::class.java) ?: return
		if (manager.getNotificationChannel(CHANNEL_ID) != null) return
		manager.createNotificationChannel(
			NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH),
		)
	}

	private fun fetchBitmap(url: String): Bitmap? =
		try {
			URL(url).openStream().use { BitmapFactory.decodeStream(it) }
		} catch (e: Exception) {
			null
		}

	// MessagingStyle can only inline an image via a content Uri, so the fetched
	// bitmap is written to the cache dir and handed out through the app's
	// FileProvider. The system grants SystemUI temporary read access to content
	// Uris referenced by a posted notification, so no extra permission grant is
	// needed here.
	private fun cacheImageUri(bitmap: Bitmap): Uri? =
		try {
			val dir = File(cacheDir, "notification_images").apply { mkdirs() }
			val file = File(dir, "notif_${System.currentTimeMillis()}.jpg")
			FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
			FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
		} catch (e: Exception) {
			null
		}

	private fun showNotification(
		channelUri: String,
		messageUri: String?,
		authorName: String,
		body: String,
		deepLink: String?,
		communityName: String?,
		communityAvatar: Bitmap?,
		authorAvatar: Bitmap?,
		attachmentImage: Bitmap?,
	) {
		val notificationId = channelUri.hashCode()
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
					communityName?.let { style.conversationTitle = it }
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
			NotificationCompat.Builder(this, CHANNEL_ID)
				.setSmallIcon(R.drawable.ic_notification)
				.setStyle(messagingStyle)
				.setAutoCancel(true)
				.setPriority(NotificationCompat.PRIORITY_HIGH)
				.setCategory(NotificationCompat.CATEGORY_MESSAGE)
				.addExtras(Bundle().apply { putStringArrayList(EXTRA_MESSAGE_URIS, uris) })

		communityAvatar?.let { builder.setLargeIcon(it) }
		contentIntent?.let { builder.setContentIntent(it) }

		try {
			NotificationManagerCompat.from(this).notify(notificationId, builder.build())
		} catch (e: SecurityException) {
			// POST_NOTIFICATIONS not granted — nothing to do.
		}
	}

	private fun removeMessageFromTray(channelUri: String, messageUri: String) {
		val notificationId = channelUri.hashCode()
		val manager = getSystemService(NotificationManager::class.java) ?: return
		val existing =
			manager.activeNotifications.firstOrNull { it.id == notificationId }?.notification
				?: return
		val uris = existing.extras.getStringArrayList(EXTRA_MESSAGE_URIS) ?: return
		val index = uris.indexOf(messageUri)
		if (index < 0) return

		val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(existing)
		val messages = style?.messages
		if (messages == null || messages.size <= 1 || messages.size != uris.size) {
			NotificationManagerCompat.from(this).cancel(notificationId)
			return
		}

		val rebuiltStyle = NotificationCompat.MessagingStyle(style.user)
		style.conversationTitle?.let { rebuiltStyle.conversationTitle = it }
		messages.forEachIndexed { i, message ->
			if (i == index) return@forEachIndexed
			val copy =
				NotificationCompat.MessagingStyle.Message(
					message.text ?: "",
					message.timestamp,
					message.person,
				)
			val mimeType = message.dataMimeType
			val dataUri = message.dataUri
			if (mimeType != null && dataUri != null) copy.setData(mimeType, dataUri)
			rebuiltStyle.addMessage(copy)
		}

		val remainingUris = ArrayList(uris).apply { removeAt(index) }

		val builder =
			NotificationCompat.Builder(this, CHANNEL_ID)
				.setSmallIcon(R.drawable.ic_notification)
				.setStyle(rebuiltStyle)
				.setAutoCancel(true)
				.setPriority(NotificationCompat.PRIORITY_HIGH)
				.setCategory(NotificationCompat.CATEGORY_MESSAGE)
				.addExtras(Bundle().apply { putStringArrayList(EXTRA_MESSAGE_URIS, remainingUris) })

		existing.contentIntent?.let { builder.setContentIntent(it) }

		try {
			NotificationManagerCompat.from(this).notify(notificationId, builder.build())
		} catch (e: SecurityException) {
			// POST_NOTIFICATIONS not granted — nothing to do.
		}
	}
}
