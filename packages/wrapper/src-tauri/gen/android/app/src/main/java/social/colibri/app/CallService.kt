package social.colibri.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

class CallService : Service() {
  private var focusRequest: AudioFocusRequest? = null
  private var audioActive = false
  private var keepAlive: AudioTrack? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val info = CallInfo.from(intent?.getStringExtra(EXTRA_INFO))
    if (info == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    ensureChannel()
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      buildNotification(info),
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
      } else {
        0
      }
    )
    enterCallAudio()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    leaveCallAudio()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun audioManager() = getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private fun enterCallAudio() {
    if (audioActive) return
    audioActive = true
    val audio = audioManager()
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    inCall = true
    routeCallAudio(audio)
    startKeepAlive()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        .build()
      focusRequest = request
      audio.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audio.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN)
    }
  }

  private fun leaveCallAudio() {
    if (!audioActive) return
    audioActive = false
    inCall = false
    stopKeepAlive()
    val audio = audioManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audio.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else {
      @Suppress("DEPRECATION")
      audio.abandonAudioFocus(null)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      audio.clearCommunicationDevice()
    } else {
      @Suppress("DEPRECATION")
      audio.isSpeakerphoneOn = false
    }
    audio.mode = AudioManager.MODE_NORMAL
  }

  private fun startKeepAlive() {
    if (keepAlive != null) return
    val rate = 16000
    val frames = rate / 10
    val track = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(rate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build()
      )
      .setTransferMode(AudioTrack.MODE_STATIC)
      .setBufferSizeInBytes(frames * 2)
      .build()
    track.write(ShortArray(frames), 0, frames)
    track.setLoopPoints(0, frames, -1)
    track.play()
    keepAlive = track
  }

  private fun stopKeepAlive() {
    keepAlive?.let {
      it.stop()
      it.release()
    }
    keepAlive = null
  }

  private fun routeCallAudio(audio: AudioManager) {
    val preferred = listOf(
      AudioDeviceInfo.TYPE_BLE_HEADSET,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val devices = audio.availableCommunicationDevices
      val device = preferred.firstNotNullOfOrNull { type -> devices.firstOrNull { it.type == type } }
      if (device != null) audio.setCommunicationDevice(device)
      return
    }
    val outputs = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    val headset = outputs.any {
      it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
        it.type == AudioDeviceInfo.TYPE_USB_HEADSET
    }
    @Suppress("DEPRECATION")
    audio.isSpeakerphoneOn = !headset
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Voice calls", NotificationManager.IMPORTANCE_DEFAULT)
    channel.description = "Shows while you're in a voice channel"
    channel.setSound(null, null)
    channel.enableVibration(false)
    manager.createNotificationChannel(channel)
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent =
    PendingIntent.getBroadcast(
      this,
      requestCode,
      Intent(this, CallActionReceiver::class.java)
        .putExtra(CallActionReceiver.EXTRA_ACTION, action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  private fun buildNotification(info: CallInfo): android.app.Notification {
    val open = PendingIntent.getActivity(
      this,
      REQUEST_OPEN,
      Intent(this, MainActivity::class.java)
        .setAction(ACTION_OPEN_CALL)
        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val caller = Person.Builder()
      .setName(info.title)
      .setImportant(true)
      .build()
    val mute = NotificationCompat.Action.Builder(
      0,
      if (info.muted) "Unmute" else "Mute",
      actionIntent(CallActionReceiver.ACTION_MUTE, REQUEST_MUTE)
    ).build()
    val status = when {
      info.deafened -> "Deafened"
      info.muted -> "Muted"
      else -> null
    }
    val text = listOfNotNull(info.subtitle.ifBlank { null }, status).joinToString(" · ")
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_call_notification)
      .setContentTitle(info.title)
      .setContentText(text)
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setUsesChronometer(true)
      .setWhen(info.startedAt)
      .setShowWhen(true)
      .setStyle(
        NotificationCompat.CallStyle.forOngoingCall(
          caller,
          actionIntent(CallActionReceiver.ACTION_LEAVE, REQUEST_LEAVE)
        )
      )
      .addAction(mute)
      .build()
  }

  private data class CallInfo(
    val title: String,
    val subtitle: String,
    val muted: Boolean,
    val deafened: Boolean,
    val startedAt: Long
  ) {
    companion object {
      fun from(json: String?): CallInfo? {
        if (json == null) return null
        return try {
          val value = JSONObject(json)
          CallInfo(
            title = value.optString("title", "Voice call"),
            subtitle = value.optString("subtitle", ""),
            muted = value.optBoolean("muted", false),
            deafened = value.optBoolean("deafened", false),
            startedAt = value.optLong("startedAt", System.currentTimeMillis())
          )
        } catch (e: org.json.JSONException) {
          null
        }
      }
    }
  }

  companion object {
    @Volatile
    var inCall = false
      private set
    const val ACTION_OPEN_CALL = "social.colibri.app.OPEN_CALL"
    private const val EXTRA_INFO = "social.colibri.app.CALL_INFO"
    private const val CHANNEL_ID = "voice-call"
    private const val NOTIFICATION_ID = 4101
    private const val REQUEST_OPEN = 1
    private const val REQUEST_MUTE = 2
    private const val REQUEST_LEAVE = 3

    fun start(context: Context, json: String) {
      val intent = Intent(context, CallService::class.java).putExtra(EXTRA_INFO, json)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CallService::class.java))
    }
  }
}
