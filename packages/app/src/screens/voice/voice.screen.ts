import { defineScreen } from "../../screen/define";
import { type VoiceArgs, voiceScreen } from "./voice.contract";

export default defineScreen<VoiceArgs>(voiceScreen, {
	mobile: () => import("./voice.mobile"),
	desktop: () => import("./voice.desktop"),
});
