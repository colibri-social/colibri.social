package social.colibri.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.getStringExtra(EXTRA_ACTION) ?: return
    val delivered = CallEvents.dispatch(action)
    if (!delivered && action == ACTION_LEAVE) CallService.stop(context)
  }

  companion object {
    const val EXTRA_ACTION = "social.colibri.app.CALL_ACTION"
    const val ACTION_MUTE = "mute"
    const val ACTION_LEAVE = "leave"
  }
}
