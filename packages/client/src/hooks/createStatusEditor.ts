import { createSignal } from "solid-js";
import { toast } from "somoto";
import { colibri } from "../atproto/lexicons";
import { useUserContext } from "../contexts/User";
import { createLogger } from "../utils/logger";

const log = createLogger("status");

export const createStatusEditor = () => {
	const user = useUserContext();

	const currentText = () => user.presence?.status?.text ?? "";
	const currentEmoji = () => user.presence?.status?.emoji ?? "";

	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal(currentText());
	const [emoji, setEmoji] = createSignal(currentEmoji());

	const save = async () => {
		setLoading(true);

		const res = await user.xrpc.call(colibri.actor.setStatus.main, {
			body: { text: status().trim(), emoji: emoji().trim() },
		});

		setLoading(false);

		if (!res.ok) {
			log.error("saving the status failed", { code: res.error.code });
			toast.error("Failed to update status.");
			return;
		}

		user.updateProfile({ presence: res.data.presence });
		toast.success("Status updated.");
	};

	const reset = async () => {
		setStatus(currentText());
		setEmoji(currentEmoji());
		setLoading(false);
	};

	const hasEdited = () =>
		status() !== currentText() || emoji() !== currentEmoji();

	return {
		status,
		setStatus,
		emoji,
		setEmoji,
		loading,
		save,
		reset,
		hasEdited,
	};
};
