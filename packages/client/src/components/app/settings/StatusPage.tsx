import twemoji from "@twemoji/api";
import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import SmileyIcon from "~icons/ph/smiley";
import { putRecord } from "../../../atproto/pds";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput } from "../../ui/TextField";
import { EmojiPopover } from "../common/EmojiPopover";
import { SettingsPage } from "../common/SettingsModal";

export const StatusPage: Component = () => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal(false);
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const [status, setStatus] = createSignal(user.data.status?.text || "");
	const [emoji, setEmoji] = createSignal(user.data.status?.emoji || "");

	const saveStatus = async () => {
		setLoading(true);

		try {
			const { agent } = user.atproto;
			const repo = user.did;

			// Status and emoji live in the `social.colibri.actor.data` record
			// alongside the user's community list, so read the current record first
			// to preserve `communities` before writing the new status back.
			let record: Record<string, unknown> = { status: "", communities: [] };
			try {
				const res = await agent.com.atproto.repo.getRecord({
					repo,
					collection: "social.colibri.actor.data",
					rkey: "self",
				});
				record = (res.data.value as Record<string, unknown>) ?? record;
			} catch {
				// No actor.data record yet — create one from scratch.
			}

			const text = status().trim();
			const emojiValue = emoji().trim();

			record.status = text;
			if (emojiValue) record.emoji = emojiValue;
			else delete record.emoji;

			await putRecord(agent, repo, "social.colibri.actor.data", "self", record);

			// Patch the local cache so the new status shows without a full refetch.
			user.updateActorData({
				status:
					text || emojiValue
						? { text, emoji: emojiValue || undefined }
						: undefined,
			});

			toast.success("Status updated.");
		} catch (err) {
			console.error("[StatusPage] Failed to save status", err);
			toast.error("Failed to update status.");
		} finally {
			setLoading(false);
		}
	};

	const resetStatus = async () => {
		setStatus(user.data.status?.text || "");
		setEmoji(user.data.status?.emoji || "");
		setLoading(false);
	};

	const hasEdited = () =>
		status() !== (user.data.status?.text || "") ||
		emoji() !== (user.data.status?.emoji || "");

	return (
		<SettingsPage
			loading={loading}
			title="Status"
			onSave={saveStatus}
			onReset={resetStatus}
			canReset={hasEdited()}
		>
			<TextField
				value={status()}
				onChange={setStatus}
				validationState={
					status() !== undefined && status()!.trim().length < 33
						? "valid"
						: "invalid"
				}
				class="gap-0 relative"
			>
				<EmojiPopover
					emojiPopoverOpen={popoverOpen}
					setEmojiPopoverOpen={setPopoverOpen}
					onEmojiClick={(e) => setEmoji(e.emoji)}
				>
					<Button
						variant="secondary"
						class="absolute top-0.5 left-0.5 rounded-sm w-8 h-8 p-2"
						size="sm"
					>
						<Switch>
							<Match when={emoji()}>
								<div innerHTML={twemoji.parse(emoji())} />
							</Match>
							<Match when={!emoji()}>
								<SmileyIcon />
							</Match>
						</Switch>
					</Button>
				</EmojiPopover>
				<TextFieldInput
					maxLength={32}
					required
					type="text"
					class="resize-none pl-10"
				/>
			</TextField>
			<Button
				variant="secondary"
				classList={{
					"hidden!":
						hasEdited() || (emoji()?.length === 0 && status()?.length === 0),
				}}
				onClick={() => {
					setEmoji("");
					setStatus("");
					saveStatus();
				}}
			>
				Reset Status
			</Button>
		</SettingsPage>
	);
};
