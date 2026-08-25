import {
	type Component,
	createSignal,
	Match,
	onCleanup,
	onMount,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import SmileyIcon from "~icons/ph/smiley";
import {
	getPreferences,
	shareActivityOf,
	writeShareActivity,
} from "../../../atproto/notificationPreference";
import { frameIs } from "../../../atproto/sync-frames";
import { useSocketContext } from "../../../contexts/Socket";
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
	const socket = useSocketContext();
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const [savedSharing, setSavedSharing] = createSignal(false);
	const [sharing, setSharing] = createSignal(false);
	const [savingSharing, setSavingSharing] = createSignal(false);

	const sharingEdited = () => sharing() !== savedSharing();

	const adoptSharing = (value: boolean) => {
		const edited = sharingEdited();
		setSavedSharing(value);
		if (!edited) setSharing(value);
	};

	onMount(async () => {
		const res = await getPreferences(user.xrpc);
		if (res.ok) adoptSharing(shareActivityOf(res.data.preferences));
	});

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (!frameIs(event, "preferencesEvent")) return;
			adoptSharing(shareActivityOf(event.preferences));
		});
		onCleanup(cleanup);
	});

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

		setSavedSharing(wanted);
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
		setSharing(savedSharing());
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
				onChange={setSharing}
			>
				<div>
					<SwitchLabel>Share what I'm listening to</SwitchLabel>
					<SwitchDescription>
						Shows the track you're playing on your profile and in the member
						list, read from the teal.fm records on your account. Turning this
						off clears it for everyone as soon as you save.
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
