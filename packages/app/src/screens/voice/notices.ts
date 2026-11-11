import { toast } from "@colibri-social/ui";
import { VOICE_MOVE_COPY, VOICE_NOTICE_COPY } from "../../data/error-copy";
import { setVoiceMoveNotifier, setVoiceNotifier } from "../../data/voice";

export const MOVE_TOAST_ID = "voice-move";

export const installVoiceNotices = () => {
	setVoiceNotifier((key) => {
		const copy = VOICE_NOTICE_COPY[key];
		toast(copy.title, { description: copy.description });
	});
	setVoiceMoveNotifier((move) => {
		if (!move) {
			toast.dismiss(MOVE_TOAST_ID);
			return;
		}

		const seconds = Math.max(
			0,
			Math.round((move.deadline - Date.now()) / 1000),
		);

		toast(VOICE_MOVE_COPY.title, {
			id: MOVE_TOAST_ID,
			description: VOICE_MOVE_COPY.description(seconds),
			duration: Math.max(5_000, move.deadline - Date.now()),
			action: { label: VOICE_MOVE_COPY.action, onClick: move.moveNow },
		});
	});
};
