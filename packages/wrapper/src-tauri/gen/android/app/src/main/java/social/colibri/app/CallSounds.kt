package social.colibri.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.Build
import android.util.Base64
import java.io.File

object CallSounds {
  private var callPool: SoundPool? = null
  private var mediaPool: SoundPool? = null
  private val callIds = mutableMapOf<String, Int>()
  private val mediaIds = mutableMapOf<String, Int>()
  private val pendingPlays = mutableMapOf<Int, Pair<SoundPool, Float>>()
  private val speakerPlayers = mutableMapOf<String, MediaPlayer>()

  private val headsetTypes = setOf(
    AudioDeviceInfo.TYPE_WIRED_HEADSET,
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    AudioDeviceInfo.TYPE_USB_HEADSET,
    AudioDeviceInfo.TYPE_BLE_HEADSET,
  )

  private fun file(context: Context, name: String) =
    File(File(context.cacheDir, "sounds").apply { mkdirs() }, "${name.filter { it.isLetterOrDigit() || it == '-' || it == '_' }}.mp3")

  fun has(context: Context, name: String) = file(context, name).exists()

  fun store(context: Context, name: String, base64: String) {
    file(context, name).writeBytes(Base64.decode(base64, Base64.DEFAULT))
    callIds.remove(name)
    mediaIds.remove(name)
  }

  private fun pool(usage: Int): SoundPool =
    SoundPool.Builder()
      .setMaxStreams(4)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(usage)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      .build()
      .also { created ->
        created.setOnLoadCompleteListener { loaded, id, status ->
          val volume = pendingPlays.remove(id)?.second
          if (status == 0 && volume != null) loaded.play(id, volume, volume, 1, 0, 1f)
        }
      }

  private fun playFromPool(target: SoundPool, ids: MutableMap<String, Int>, name: String, sound: File, volume: Float) {
    val existing = ids[name]
    if (existing != null) {
      target.play(existing, volume, volume, 1, 0, 1f)
      return
    }
    val id = target.load(sound.path, 1)
    ids[name] = id
    pendingPlays[id] = target to volume
  }

  private fun builtInSpeaker(audio: AudioManager): AudioDeviceInfo? {
    val outputs = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    if (outputs.any { it.type in headsetTypes }) return null
    return outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
  }

  private fun playOnSpeaker(name: String, sound: File, speaker: AudioDeviceInfo, volume: Float) {
    speakerPlayers.remove(name)?.release()
    val player = MediaPlayer()
    speakerPlayers[name] = player
    val release = {
      if (speakerPlayers[name] === player) speakerPlayers.remove(name)
      player.release()
    }
    try {
      player.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      player.setDataSource(sound.path)
      player.setPreferredDevice(speaker)
      player.setVolume(volume, volume)
      player.setOnPreparedListener { it.start() }
      player.setOnCompletionListener { release() }
      player.setOnErrorListener { _, _, _ ->
        release()
        true
      }
      player.prepareAsync()
    } catch (error: Exception) {
      release()
    }
  }

  fun play(context: Context, name: String, volume: Float = 1f) {
    val level = volume.coerceIn(0f, 1f)
    if (level <= 0f) return
    val sound = file(context, name)
    if (!sound.exists()) return
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (audio.ringerMode != AudioManager.RINGER_MODE_NORMAL) return
    if (CallService.inCall) {
      val target = callPool ?: pool(AudioAttributes.USAGE_VOICE_COMMUNICATION).also { callPool = it }
      playFromPool(target, callIds, name, sound, level)
      return
    }
    val speaker = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builtInSpeaker(audio) else null
    if (speaker != null) {
      playOnSpeaker(name, sound, speaker, level)
      return
    }
    val target = mediaPool ?: pool(AudioAttributes.USAGE_MEDIA).also { mediaPool = it }
    playFromPool(target, mediaIds, name, sound, level)
  }
}
