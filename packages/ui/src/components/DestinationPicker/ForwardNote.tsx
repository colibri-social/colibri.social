import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { utf8Length } from "../../utils/text-length";
import {
	CHARACTER_LIMIT,
	CharacterRing,
	characterRingSlotClass,
} from "../Composer/CharacterRing";
import type { EmojiPick } from "../EmojiPicker/EmojiPicker";
import {
	EmojiPickerPopover,
	type EmojiPickerPopoverProps,
} from "../EmojiPicker/EmojiPickerPopover";
import { IconButton } from "../IconButton/IconButton";
import {
	RichEditor,
	type RichEditorHandle,
	type RichEditorProps,
} from "../RichEditor/RichEditor";
import type { RichEditorSources, RichText } from "../RichEditor/types";

export const FORWARD_NOTE_RING_THRESHOLD = 0.8;

export const FORWARD_NOTE_HEIGHT_CLASS = "h-[42px]";

export type ForwardNoteEmoji = Pick<
	EmojiPickerPopoverProps,
	"usage" | "skinTone" | "onSkinToneChange" | "packs"
> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (pick: EmojiPick) => void;
};

export type ForwardNoteProps = {
	platform: "desktop" | "mobile";
	sources?: RichEditorSources;
	problem?: { kind: string; hint: string };
	disabled?: boolean;
	canSubmit?: (value: RichText) => boolean;
	onSubmit?: RichEditorProps["onSubmit"];
	onChange?: (value: RichText) => void;
	emoji?: ForwardNoteEmoji;
	ref?: (handle: RichEditorHandle) => void;
	class?: string;
};

export const ForwardNote = (props: ForwardNoteProps): JSX.Element => {
	let editor: RichEditorHandle | undefined;
	const [length, setLength] = createSignal(0);
	const desktop = () => props.platform === "desktop";

	return (
		<div class={cx("flex min-w-0 flex-1 flex-col gap-1.5", props.class)}>
			<div
				data-forward-note=""
				data-invalid={props.problem ? "" : undefined}
				class={cx(
					"flex min-w-0 items-start gap-2 rounded-control border border-control-border bg-secondary px-3 py-2",
					"focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
					"data-invalid:border-destructive",
				)}
			>
				<RichEditor
					platform={props.platform}
					aria-label="Add a message"
					placeholder="Add a message"
					maxLength={CHARACTER_LIMIT}
					maxLines={desktop() ? 6 : 4}
					disabled={props.disabled}
					sources={props.sources}
					canSubmit={props.canSubmit}
					onSubmit={props.onSubmit}
					onChange={(value) => {
						setLength(utf8Length(value.text));
						props.onChange?.(value);
					}}
					ref={(handle) => {
						editor = handle;
						props.ref?.(handle);
					}}
				/>
				<Show when={props.emoji}>
					{(emoji) => (
						<EmojiPickerPopover
							open={emoji().open}
							onOpenChange={emoji().onOpenChange}
							returnFocusTo={() => editor?.element()}
							platform={props.platform}
							placement="top-end"
							usage={emoji().usage}
							skinTone={emoji().skinTone}
							onSkinToneChange={emoji().onSkinToneChange}
							packs={emoji().packs}
							onPick={emoji().onPick}
							anchor={
								<IconButton
									variant="ghost"
									label="Add an emoji"
									icon={<SmileCircleIcon />}
									data-forward-note-emoji=""
									class="-my-1 -mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
									disabled={props.disabled}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => emoji().onOpenChange(!emoji().open)}
								/>
							}
						/>
					)}
				</Show>
				<span
					data-ring-slot=""
					data-visible={
						length() / CHARACTER_LIMIT >= FORWARD_NOTE_RING_THRESHOLD ||
						undefined
					}
					class={cx(characterRingSlotClass, "-my-1 -ml-2")}
				>
					<CharacterRing
						length={length()}
						max={CHARACTER_LIMIT}
						threshold={FORWARD_NOTE_RING_THRESHOLD}
					/>
				</span>
			</div>
			<Show when={props.problem}>
				{(current) => (
					<p
						data-forward-note-problem={current().kind}
						role="status"
						class="m-0 text-xs leading-4 text-destructive"
					>
						{current().hint}
					</p>
				)}
			</Show>
		</div>
	);
};
