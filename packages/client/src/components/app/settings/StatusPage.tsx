import { type Component, createSignal, Match, Switch } from "solid-js";
import SmileyIcon from "~icons/ph/smiley";
import { createStatusEditor } from "../../../hooks/createStatusEditor";
import { parseEmojiText } from "../../../utils/emoji";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput } from "../../ui/TextField";
import { EmojiPopover } from "../common/EmojiPopover";
import { SettingsPage } from "../common/SettingsModal";

export const StatusPage: Component = () => {
	const [popoverOpen, setPopoverOpen] = createSignal(false);
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

	return (
		<SettingsPage
			loading={loading}
			title="Status"
			onSave={save}
			onReset={reset}
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
