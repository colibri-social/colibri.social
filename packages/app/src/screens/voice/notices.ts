import { toast } from "@colibri-social/ui";
import { VOICE_NOTICE_COPY } from "../../data/error-copy";
import { setVoiceNotifier } from "../../data/voice";

export const installVoiceNotices = () =>
	setVoiceNotifier((key) => {
		const copy = VOICE_NOTICE_COPY[key];
		toast(copy.title, { description: copy.description });
	});
