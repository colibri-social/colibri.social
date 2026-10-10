import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal, onMount, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { utf8Length } from "../../utils/text-length";
import { Button } from "../Button/Button";
import {
	CHARACTER_LIMIT,
	CharacterRing,
	characterRingSlotClass,
} from "../Composer/CharacterRing";
import type { EmojiPick, EmojiPickerProps } from "../EmojiPicker/EmojiPicker";
import { EmojiPickerPopover } from "../EmojiPicker/EmojiPickerPopover";
import { IconButton } from "../IconButton/IconButton";
import { RichEditor, type RichEditorHandle } from "../RichEditor/RichEditor";
import type { RichEditorSources, RichText } from "../RichEditor/types";
import type { MessagePlatform } from "./MessageRow";

export type MessageEditing = {
	value: RichText | string;
	onSave: (value: RichText) => unknown;
	onCancel: () => void;
	onChange?: (value: RichText) => void;
	allowEmpty?: boolean;
	maxLength?: number;
	sources?: RichEditorSources;
	placeholder?: string;
	emoji?: Omit<EmojiPickerProps, "platform" | "onPick" | "autofocus">;
};

export const emojiPickText = (pick: EmojiPick) =>
	pick.kind === "unicode" ? pick.emoji : `:${pick.emoji.name}:`;

export type MessageEditorProps = {
	editing: MessageEditing;
	platform?: MessagePlatform;
	class?: string;
};

const toRichText = (value: RichText | string): RichText =>
	typeof value === "string" ? { text: value, facets: [] } : value;

const sameRichText = (a: RichText, b: RichText) =>
	a.text === b.text && JSON.stringify(a.facets) === JSON.stringify(b.facets);

const RING_THRESHOLD = 0.8;

const hintButton =
	"cursor-pointer rounded-control-xs font-semibold text-primary-highlight outline-none hover:underline focus-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline";

export const MessageEditor = (props: MessageEditorProps) => {
	const original = toRichText(props.editing.value);
	const [current, setCurrent] = createSignal<RichText>(original);
	const [saving, setSaving] = createSignal(false);
	const [handle, setHandle] = createSignal<RichEditorHandle>();
	const [emojiOpen, setEmojiOpen] = createSignal(false);
	let root: HTMLDivElement | undefined;

	const platform = () => props.platform ?? "desktop";
	const ringVisible = () =>
		utf8Length(current().text) / max() >= RING_THRESHOLD;
	const max = () => props.editing.maxLength ?? CHARACTER_LIMIT;
	const saveable = (value: RichText) => {
		if (utf8Length(value.text) > max()) return false;
		if (value.text.trim().length === 0) return !!props.editing.allowEmpty;
		return true;
	};

	const save = async (value: RichText): Promise<boolean> => {
		if (saving() || !saveable(value)) return false;
		if (sameRichText(value, original)) {
			props.editing.onCancel();
			return true;
		}
		setSaving(true);
		try {
			const result = await props.editing.onSave(value);
			return result !== false;
		} catch {
			return false;
		} finally {
			setSaving(false);
		}
	};

	const cancel = () => {
		if (saving()) return;
		props.editing.onCancel();
	};

	onMount(() => {
		queueMicrotask(() => {
			handle()?.focus("end");
			root?.scrollIntoView?.({ block: "nearest" });
		});
	});

	return (
		<div
			ref={root}
			data-message-editor=""
			data-platform={platform()}
			class={cx("flex min-w-0 flex-col gap-1.5", props.class)}
		>
			<div
				data-message-editor-box=""
				class={cx(
					"flex min-w-0 items-start gap-2 rounded-control border border-control-border bg-secondary px-3 py-2",
					"focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
				)}
			>
				<RichEditor
					platform={platform()}
					aria-label="Edit message"
					placeholder={
						props.editing.placeholder ??
						(props.editing.allowEmpty ? "Add a message" : undefined)
					}
					initialValue={original}
					submitOnEnter={platform() === "desktop"}
					maxLength={max()}
					maxLines={10}
					disabled={saving()}
					sources={props.editing.sources}
					canSubmit={saveable}
					onSubmit={save}
					onEscape={cancel}
					onChange={(value) => {
						setCurrent(value);
						props.editing.onChange?.(value);
					}}
					ref={setHandle}
				/>
				<EmojiPickerPopover
					{...(props.editing.emoji ?? {})}
					open={emojiOpen()}
					onOpenChange={setEmojiOpen}
					returnFocusTo={() => handle()?.element()}
					platform={platform()}
					placement="top-end"
					onPick={(pick) => handle()?.insertText(emojiPickText(pick))}
					anchor={
						<IconButton
							variant="ghost"
							label="Add an emoji"
							icon={<SmileCircleIcon />}
							data-message-editor-emoji=""
							class="-my-[5.5px] -mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
							disabled={saving()}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => setEmojiOpen((open) => !open)}
						/>
					}
				/>
				<span
					data-ring-slot=""
					data-visible={ringVisible() || undefined}
					class={cx(characterRingSlotClass, "-my-[5.5px] -ml-2")}
				>
					<CharacterRing
						length={utf8Length(current().text)}
						max={max()}
						threshold={RING_THRESHOLD}
					/>
				</span>
			</div>
			<Show
				when={platform() === "mobile"}
				fallback={
					<p
						data-message-editor-hint=""
						class="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"
					>
						<small class="text-xs">
							escape to{" "}
							<button
								type="button"
								class={hintButton}
								disabled={saving()}
								onClick={cancel}
							>
								cancel
							</button>
						</small>
						<span
							aria-hidden="true"
							class="size-1 shrink-0 rounded-full bg-muted-foreground"
						/>
						<small class="text-xs">
							enter to{" "}
							<button
								type="button"
								class={hintButton}
								disabled={saving() || !saveable(current())}
								onClick={() => handle()?.submit()}
							>
								submit
							</button>
						</small>
					</p>
				}
			>
				<div data-message-editor-actions="" class="flex justify-end gap-2">
					<Button
						variant="secondary"
						class="h-8 rounded-control-sm px-3"
						disabled={saving()}
						onClick={cancel}
					>
						Cancel
					</Button>
					<Button
						class="h-8 rounded-control-sm px-3"
						loading={saving()}
						disabled={!saveable(current())}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => handle()?.submit()}
					>
						Save
					</Button>
				</div>
			</Show>
		</div>
	);
};
