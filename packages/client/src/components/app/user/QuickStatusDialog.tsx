import { type Component, createSignal, Match, Show, Switch } from "solid-js";
import SmileyIcon from "~icons/ph/smiley";
import XIcon from "~icons/ph/x";
import { useUserContext } from "../../../contexts/User";
import { createStatusEditor } from "../../../hooks/createStatusEditor";
import { parseEmojiText } from "../../../utils/emoji";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { EmojiPopover } from "../common/EmojiPopover";
import { ProfilePopoverContents } from "./ProfilePopover";

export const QuickStatusDialog: Component<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
}> = (props) => {
	const user = useUserContext();
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const { status, setStatus, emoji, setEmoji, loading, save } =
		createStatusEditor();

	const hasDraft = () =>
		(status()?.length ?? 0) > 0 || (emoji()?.length ?? 0) > 0;

	const previewUser = () => ({
		...user,
		data: {
			...user.data,
			status: hasDraft()
				? { text: status(), emoji: emoji() || undefined }
				: undefined,
		},
	});

	const handleSave = async () => {
		await save();
		props.onOpenChange(false);
	};

	const clear = () => {
		setStatus("");
		setEmoji("");
	};

	return (
		<ResponsiveDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title="Set your status"
			contentClass="w-[26rem]"
		>
			<div class="rounded-lg border border-border overflow-hidden">
				<ProfilePopoverContents
					user={previewUser()}
					class="w-full pointer-events-none"
					hideDescription
				/>
			</div>
			<TextField value={status()} onChange={setStatus} class="gap-1.5">
				<TextFieldLabel>Status</TextFieldLabel>
				<div class="relative">
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
						type="text"
						class="resize-none pl-10 pr-9 w-full"
					/>
					<Show when={hasDraft()}>
						<button
							type="button"
							class="absolute z-20 right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted/50 cursor-pointer text-muted-foreground"
							onClick={clear}
						>
							<XIcon />
						</button>
					</Show>
				</div>
			</TextField>
			<DialogFooter>
				<Button
					variant="secondary"
					onClick={() => props.onOpenChange(false)}
					disabled={loading()}
				>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={loading()}>
					Save
				</Button>
			</DialogFooter>
		</ResponsiveDialog>
	);
};
