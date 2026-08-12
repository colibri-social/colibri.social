import { createSignal } from "solid-js";
import { toast } from "somoto";
import { putRecord } from "../atproto/pds";
import { useUserContext } from "../contexts/User";
import { classifyThrown, isRecordNotFound } from "../errors/classify";
import { createLogger } from "../utils/logger";

const log = createLogger("status");

export const createStatusEditor = () => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal(user.data.status?.text || "");
	const [emoji, setEmoji] = createSignal(user.data.status?.emoji || "");

	const save = async () => {
		setLoading(true);

		try {
			const { agent } = user.atproto;
			const repo = user.did;

			let record: Record<string, unknown> = { status: "", communities: [] };
			try {
				const res = await agent.com.atproto.repo.getRecord({
					repo,
					collection: "social.colibri.actor.data",
					rkey: "self",
				});
				record = (res.data.value as Record<string, unknown>) ?? record;
			} catch (err) {
				if (!isRecordNotFound(err)) {
					throw classifyThrown(err, { method: "com.atproto.repo.getRecord" });
				}
			}

			const text = status().trim();
			const emojiValue = emoji().trim();

			record.status = text;
			if (emojiValue) record.emoji = emojiValue;
			else delete record.emoji;

			await putRecord(agent, repo, "social.colibri.actor.data", "self", record);

			user.updateActorData({
				status:
					text || emojiValue
						? { text, emoji: emojiValue || undefined }
						: undefined,
			});

			toast.success("Status updated.");
		} catch (err) {
			log.error("saving the status failed", { code: classifyThrown(err).code });
			toast.error("Failed to update status.");
		} finally {
			setLoading(false);
		}
	};

	const reset = async () => {
		setStatus(user.data.status?.text || "");
		setEmoji(user.data.status?.emoji || "");
		setLoading(false);
	};

	const hasEdited = () =>
		status() !== (user.data.status?.text || "") ||
		emoji() !== (user.data.status?.emoji || "");

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
