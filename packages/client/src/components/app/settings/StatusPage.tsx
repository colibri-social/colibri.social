import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import SmileyIcon from "~icons/ph/smiley";
import {
	activitySharing,
	noteActivitySharing,
} from "../../../atproto/activity-suggestion";
import { writeShareActivity } from "../../../atproto/notificationPreference";
import { useUserContext } from "../../../contexts/User";
import { createStatusEditor } from "../../../hooks/createStatusEditor";
import { parseEmojiText } from "../../../utils/emoji";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";
import { TextField, TextFieldInput } from "../../ui/TextField";
import { EmojiPopover } from "../common/EmojiPopover";
import { SettingsPage } from "../common/SettingsModal";

const log = createLogger("settings/status");

export const StatusPage: Component = () => {
	const user = useUserContext();
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const [draft, setDraft] = createSignal<boolean | undefined>(undefined);
	const [savingSharing, setSavingSharing] = createSignal(false);

	const savedSharing = () => activitySharing() === true;
	const sharing = () => draft() ?? savedSharing();
	const sharingEdited = () =>
		draft() !== undefined && draft() !== savedSharing();

	const {
		status,
		setStatus,
		emoji,
		setEmoji,
		loading,
		save,
		reset,
		hasEdited,
	} = createStatusEditor();

	const saveSharing = async (): Promise<boolean> => {
		const wanted = sharing();
		setSavingSharing(true);

		const res = await writeShareActivity(
			user.atproto.agent,
			user.xrpc,
			user.did,
			wanted,
		);

		setSavingSharing(false);

		if (!res.ok) {
			log.error("saving the activity sharing preference failed", {
				code: res.error.code,
			});
			toast.error("Could not save that preference.");
			return false;
		}

		noteActivitySharing(wanted);
		setDraft(undefined);
		return true;
	};

	const saveAll = async () => {
		if (sharingEdited() && !(await saveSharing())) return;
		if (hasEdited()) {
			await save();
			return;
		}
		toast.success("Preferences updated.");
	};

	const resetAll = async () => {
		setDraft(undefined);
		await reset();
	};

	return (
		<SettingsPage
			loading={() => loading() || savingSharing()}
			title="Status"
			onSave={saveAll}
			onReset={resetAll}
			canReset={hasEdited() || sharingEdited()}
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
								<div innerHTML={parseEmojiText(emoji())} />
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
			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0 mt-4"
				checked={sharing()}
				onChange={setDraft}
			>
				<div>
					<SwitchLabel>Share what I'm listening to</SwitchLabel>
					<SwitchDescription>
						Shows what you're playing on your profile and in the member list,
						read from your teal.fm, rocksky.app, or atradio.fm records. Turning
						this off clears it for everyone as soon as you save.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>
			<Button
				variant="secondary"
				classList={{
					"hidden!":
						hasEdited() || (emoji()?.length === 0 && status()?.length === 0),
				}}
				onClick={() => {
					setEmoji("");
					setStatus("");
					save();
				}}
			>
				Reset Status
			</Button>
		</SettingsPage>
	);
};
