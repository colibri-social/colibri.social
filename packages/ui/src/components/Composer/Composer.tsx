import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createEffect, createSignal, type JSX, on, Show } from "solid-js";
import type { AnimatedIconHandle } from "../../icons/animated/AnimatedIcon";
import { AnimatedGifIcon } from "../../icons/animated/brand";
import { AnimatedSendIcon } from "../../icons/animated/icons";
import { AnimatedUploadIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { iconEffectClass } from "../../utils/icon-fx";
import { createSlot } from "../../utils/slot";
import { utf8Length } from "../../utils/text-length";
import { IconButton } from "../IconButton/IconButton";
import { chatLayoutVars } from "../Message/layout";
import {
	DEFAULT_LINE_HEIGHT,
	RichEditor,
	type RichEditorHandle,
} from "../RichEditor/RichEditor";
import type { RichEditorSources, RichText } from "../RichEditor/types";
import {
	CHARACTER_LIMIT,
	CharacterRing,
	characterRingSlotClass as ringSlotClass,
} from "./CharacterRing";
import { EditBar } from "./ComposerBar";

export type ComposerPlatform = "mobile" | "desktop";

export type ComposerEditing = {
	value: RichText | string;
	preview?: JSX.Element;
	onSave: (
		value: RichText,
	) => boolean | undefined | Promise<boolean | undefined>;
	onCancel: () => void;
	allowEmpty?: boolean;
};

export type ComposerProps = {
	platform?: ComposerPlatform;
	channelName?: string;
	placeholder?: string;
	value?: RichText | string;
	defaultValue?: RichText | string;
	onInput?: (text: string) => void;
	onChange?: (value: RichText) => void;
	onSend?: (
		value: RichText,
	) => boolean | undefined | Promise<boolean | undefined>;
	maxLength?: number;
	ringThreshold?: number;
	maxLines?: number;
	disabled?: boolean;
	disabledReason?: JSX.Element;
	disabledAction?: JSX.Element;
	hasAttachments?: boolean;
	onUpload?: (event: MouseEvent) => void;
	onEmoji?: (event: MouseEvent) => void;
	onGif?: (event: MouseEvent) => void;
	onEscape?: () => void;
	onEditLast?: () => boolean;
	onPasteFiles?: (files: File[]) => void;
	sources?: RichEditorSources;
	autofocus?: boolean;
	top?: JSX.Element;
	typing?: JSX.Element;
	editing?: ComposerEditing;
	editorRef?: (handle: RichEditorHandle) => void;
	"aria-label"?: string;
	safeBottom?: boolean;
	class?: string;
};

const DEFAULT_MAX_LINES = 8;

const toolButtonClass =
	"text-muted-foreground enabled:hover:text-foreground data-pressed:text-foreground";

const toRichText = (value: RichText | string): RichText =>
	typeof value === "string" ? { text: value, facets: [] } : value;

const textOf = (value: RichText | string | undefined) =>
	typeof value === "string" ? value : (value?.text ?? "");

const matches = (value: RichText | string, current: RichText) =>
	typeof value === "string"
		? value === current.text && current.facets.length === 0
		: value.text === current.text &&
			JSON.stringify(value.facets) === JSON.stringify(current.facets);

export const Composer = (props: ComposerProps) => {
	const platform = () => props.platform ?? "mobile";
	const max = () => props.maxLength ?? CHARACTER_LIMIT;
	const top = createSlot(() => props.top);
	const typing = createSlot(() => props.typing);
	const [editor, setEditor] = createSignal<RichEditorHandle>();
	const initialText = textOf(props.value ?? props.defaultValue);
	const current = () => editor()?.getValue();
	const text = () => current()?.text ?? initialText;
	const editing = () => props.editing;
	const sendable = (value: RichText) => {
		if (props.disabled || utf8Length(value.text) > max()) return false;
		if (value.text.trim().length > 0) return true;
		const edit = editing();
		return edit ? !!edit.allowEmpty : !!props.hasAttachments;
	};
	const canSend = () => sendable(current() ?? { text: text(), facets: [] });
	const placeholder = () =>
		props.placeholder ??
		(props.channelName ? `Message ${props.channelName}` : "Message");

	let sendIcon: AnimatedIconHandle | undefined;

	createEffect(
		on(
			() => props.value,
			(value) => {
				const handle = editor();
				const now = current();
				if (value === undefined || !handle || !now) return;
				if (!matches(value, now)) handle.setValue(value);
			},
			{ defer: true },
		),
	);

	const draftSeed = props.value ?? props.defaultValue ?? "";
	let stashedDraft: RichText | undefined;
	let editingTarget: ComposerEditing | undefined;

	createEffect(
		on([editor, editing], ([handle, edit]) => {
			if (!handle || edit === editingTarget) return;
			const ready = handle.getJSON() !== undefined;
			if (edit && !editingTarget)
				stashedDraft = ready ? handle.getValue() : toRichText(draftSeed);
			editingTarget = edit;
			if (edit) {
				if (ready) handle.setValue(edit.value);
				queueMicrotask(() => handle.focus("end"));
				return;
			}
			handle.setValue(stashedDraft ?? "");
			stashedDraft = undefined;
		}),
	);

	const saveEdit = (edit: ComposerEditing, value: RichText) => {
		if (matches(edit.value, value)) {
			edit.onCancel();
			return true;
		}
		return edit.onSave(value);
	};

	const send = (value: RichText) => {
		const edit = editing();
		if (edit) return saveEdit(edit, value);
		const result = props.onSend?.(value);
		if (result !== false) void sendIcon?.play();
		return result;
	};

	const handleEscape = () => {
		const edit = editing();
		if (edit) {
			edit.onCancel();
			return;
		}
		props.onEscape?.();
	};

	const ringVisible = () =>
		utf8Length(text()) / max() >= (props.ringThreshold ?? 0.8);

	return (
		<div
			data-composer=""
			data-platform={platform()}
			style={chatLayoutVars(platform())}
			class={cx(
				"relative flex w-full flex-col",
				"px-(--composer-padding)",
				platform() === "desktop" ? "pb-4" : "pb-px",
				props.safeBottom &&
					(platform() === "desktop"
						? "px-safe-offset-4 pb-safe-offset-4"
						: "px-safe-offset-2 pb-safe-offset-2"),
				props.class,
			)}
		>
			<Show when={typing.has()}>
				<div
					data-composer-typing=""
					class={
						platform() === "desktop"
							? "[--typing-ring:var(--card)]"
							: "pointer-events-none [--typing-ring:var(--background)]"
					}
				>
					{typing()}
				</div>
			</Show>
			<div data-composer-anchor="" class="relative">
				<div
					data-composer-box=""
					class="flex flex-col overflow-clip rounded-control-lg border border-popover-highlight bg-popover shadow-[0_0_8px_0_rgb(0_0_0/0.5)] light:shadow-[0_0_8px_0_rgb(0_0_0/0.12)]"
				>
					<EditBar
						open={!!editing()}
						preview={editing()?.preview}
						onCancel={() => editing()?.onCancel()}
					/>
					<Show when={top.has() && !editing()}>{top()}</Show>
					<Show
						when={!props.disabled}
						fallback={
							<div
								class={cx(
									"flex min-h-12 items-center justify-between gap-3 text-sm text-muted-foreground",
									platform() === "desktop" ? "px-4 py-3" : "px-3 py-2",
								)}
							>
								<span>
									{props.disabledReason ??
										"You can't send messages in this channel."}
								</span>
								<Show when={props.disabledAction}>{props.disabledAction}</Show>
							</div>
						}
					>
						<div
							class={cx(
								"flex items-end",
								platform() === "desktop" ? "gap-3 p-3" : "gap-2 p-2",
							)}
						>
							<IconButton
								data-composer-upload=""
								variant="ghost"
								label="Upload a file"
								icon={<AnimatedUploadIcon />}
								class={toolButtonClass}
								disabled={!!editing()}
								onClick={(event) => props.onUpload?.(event)}
							/>
							<div class="flex min-h-8 min-w-0 flex-1 items-center">
								<RichEditor
									platform={platform()}
									placeholder={placeholder()}
									aria-label={props["aria-label"] ?? placeholder()}
									initialValue={
										props.editing?.value ?? props.value ?? props.defaultValue
									}
									maxLines={props.maxLines ?? DEFAULT_MAX_LINES}
									lineHeight={DEFAULT_LINE_HEIGHT}
									canSubmit={sendable}
									onSubmit={send}
									onChange={(value) => {
										props.onChange?.(value);
										props.onInput?.(value.text);
									}}
									onEscape={handleEscape}
									onEditLast={props.onEditLast}
									onPasteFiles={props.onPasteFiles}
									sources={props.sources}
									autofocus={props.autofocus}
									anchorSuggestionsToParent
									ref={(handle) => {
										setEditor(handle);
										props.editorRef?.(handle);
									}}
								/>
							</div>
							<Show when={platform() === "desktop"}>
								<IconButton
									variant="ghost"
									label="Send a GIF"
									icon={<AnimatedGifIcon />}
									class={toolButtonClass}
									disabled={!!editing()}
									onClick={(event) => props.onGif?.(event)}
								/>
							</Show>
							<Show when={platform() === "mobile"}>
								<span
									data-ring-slot=""
									data-visible={ringVisible() || undefined}
									class={cx(ringSlotClass, "-ml-2")}
								>
									<CharacterRing
										length={utf8Length(text())}
										max={max()}
										threshold={props.ringThreshold}
									/>
								</span>
							</Show>
							<IconButton
								variant="ghost"
								label="Add an emoji"
								icon={<SmileCircleIcon />}
								iconEffect="wiggle"
								class={toolButtonClass}
								onClick={(event) => props.onEmoji?.(event)}
							/>
							<Show
								when={platform() === "mobile"}
								fallback={
									<span
										data-ring-slot=""
										data-visible={ringVisible() || undefined}
										class={cx(ringSlotClass, "-ml-3")}
									>
										<CharacterRing
											length={utf8Length(text())}
											max={max()}
											threshold={props.ringThreshold}
										/>
									</span>
								}
							>
								<button
									type="button"
									aria-label={editing() ? "Save edit" : "Send message"}
									disabled={!canSend()}
									data-active={canSend() || undefined}
									data-send-button=""
									data-icon-host=""
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => editor()?.submit()}
									class={cx(
										"pressable focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border",
										"border-transparent bg-muted text-muted-foreground disabled:cursor-default",
										"data-active:border-primary-highlight data-active:bg-primary data-active:text-primary-foreground",
										"[&_svg]:pointer-events-none",
									)}
								>
									<Show
										when={editing()}
										fallback={
											<AnimatedSendIcon
												size={20}
												ref={(handle) => {
													sendIcon = handle;
												}}
											/>
										}
									>
										<span class={iconEffectClass("pop")}>
											<CheckCircleIcon class="size-5" />
										</span>
									</Show>
								</button>
							</Show>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
};
