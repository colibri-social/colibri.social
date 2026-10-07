import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { UploadIcon } from "@solar-icons/solid/bold/upload";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onMount,
	Show,
} from "solid-js";
import type { AnimatedIconHandle } from "../../icons/animated/AnimatedIcon";
import { GifGlyph } from "../../icons/animated/brand";
import { AnimatedSendIcon } from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";
import { chatLayoutVars } from "../Message/layout";
import { CHARACTER_LIMIT, CharacterRing } from "./CharacterRing";

export type ComposerPlatform = "mobile" | "desktop";

export type ComposerProps = {
	platform?: ComposerPlatform;
	channelName?: string;
	placeholder?: string;
	value?: string;
	defaultValue?: string;
	onInput?: (value: string) => void;
	onSend?: (text: string) => boolean | undefined;
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
	onPasteFiles?: (files: File[]) => void;
	top?: JSX.Element;
	typing?: JSX.Element;
	textareaRef?: (element: HTMLTextAreaElement) => void;
	"aria-label"?: string;
	safeBottom?: boolean;
	class?: string;
};

const LINE_HEIGHT_PX = 21;
const DEFAULT_MAX_LINES = 8;

const ringSlotClass = cx(
	"flex w-0 shrink-0 justify-end overflow-hidden data-visible:ml-0 data-visible:w-8",
	"transition-[width,margin] duration-[calc(var(--duration-pop,320ms)*var(--motion-scale))] ease-[var(--ease-pop,var(--ease-out-quick))]",
	"motion-reduce:transition-none reduced-motion:transition-none",
);

const toolButtonClass =
	"text-muted-foreground enabled:hover:text-foreground data-pressed:text-foreground";

export const Composer = (props: ComposerProps) => {
	const platform = () => props.platform ?? "mobile";
	const max = () => props.maxLength ?? CHARACTER_LIMIT;
	const top = createSlot(() => props.top);
	const typing = createSlot(() => props.typing);
	const [draft, setDraft] = createSignal(
		props.value ?? props.defaultValue ?? "",
	);
	const text = () => (props.value !== undefined ? props.value : draft());
	const hasContent = () => text().trim().length > 0 || !!props.hasAttachments;
	const canSend = () =>
		!props.disabled && hasContent() && text().length <= max();
	const maxHeight = () =>
		(props.maxLines ?? DEFAULT_MAX_LINES) * LINE_HEIGHT_PX;

	let textarea: HTMLTextAreaElement | undefined;
	let sendIcon: AnimatedIconHandle | undefined;

	const resize = () => {
		if (!textarea) return;
		textarea.style.height = "0px";
		const content = textarea.scrollHeight;
		const height = Math.min(content, maxHeight());
		textarea.style.height = `${Math.max(LINE_HEIGHT_PX, height)}px`;
		textarea.style.overflowY = content > maxHeight() ? "auto" : "hidden";
	};

	onMount(resize);
	createEffect(on(text, () => queueMicrotask(resize), { defer: true }));

	const update = (value: string) => {
		if (props.value === undefined) setDraft(value);
		props.onInput?.(value);
	};

	const send = () => {
		if (!canSend()) return;
		if (props.onSend?.(text()) === false) return;
		update("");
		if (textarea) textarea.value = "";
		resize();
		void sendIcon?.play();
	};

	const insertNewline = () => {
		if (!textarea) return;
		textarea.setRangeText(
			"\n",
			textarea.selectionStart,
			textarea.selectionEnd,
			"end",
		);
		update(textarea.value);
		resize();
	};

	const onKeyDown: JSX.EventHandler<HTMLTextAreaElement, KeyboardEvent> = (
		event,
	) => {
		if (event.key === "Escape") {
			props.onEscape?.();
			return;
		}
		if (event.key !== "Enter" || event.isComposing || event.keyCode === 229)
			return;
		if (platform() === "mobile" || event.shiftKey || event.altKey) return;
		event.preventDefault();
		if (event.ctrlKey || event.metaKey) {
			insertNewline();
			return;
		}
		send();
	};

	const onPaste: JSX.EventHandler<HTMLTextAreaElement, ClipboardEvent> = (
		event,
	) => {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (files.length === 0 || !props.onPasteFiles) return;
		event.preventDefault();
		props.onPasteFiles(files);
	};

	const ringVisible = () =>
		text().length / max() >= (props.ringThreshold ?? 0.8);

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
				<Show
					when={platform() === "desktop"}
					fallback={
						<div
							data-composer-typing=""
							class="pointer-events-none absolute inset-x-0 bottom-full bg-linear-to-b from-transparent to-background px-(--composer-padding) pt-3 [--typing-ring:var(--background)]"
						>
							{typing()}
						</div>
					}
				>
					<div data-composer-typing="" class="[--typing-ring:var(--card)]">
						{typing()}
					</div>
				</Show>
			</Show>
			<div
				data-composer-box=""
				class="flex flex-col overflow-clip rounded-control-lg border border-popover-highlight bg-popover shadow-[0_0_8px_0_rgb(0_0_0/0.5)] light:shadow-[0_0_8px_0_rgb(0_0_0/0.12)]"
			>
				<Show when={top.has()}>{top()}</Show>
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
							icon={<UploadIcon />}
							class={toolButtonClass}
							onClick={(event) => props.onUpload?.(event)}
						/>
						<div class="flex min-h-8 min-w-0 flex-1 items-center">
							<textarea
								ref={(element) => {
									textarea = element;
									props.textareaRef?.(element);
								}}
								rows={1}
								value={text()}
								placeholder={
									props.placeholder ??
									(props.channelName
										? `Message ${props.channelName}`
										: "Message")
								}
								aria-label={
									props["aria-label"] ??
									(props.channelName
										? `Message ${props.channelName}`
										: "Message")
								}
								enterkeyhint={platform() === "mobile" ? "enter" : "send"}
								onInput={(event) => {
									update(event.currentTarget.value);
									resize();
								}}
								onKeyDown={onKeyDown}
								onPaste={onPaste}
								class={cx(
									"block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-[21px] text-foreground outline-none",
									"placeholder:text-muted-foreground [overflow-wrap:anywhere]",
								)}
								style={{ height: `${LINE_HEIGHT_PX}px` }}
							/>
						</div>
						<Show when={platform() === "desktop"}>
							<IconButton
								variant="ghost"
								label="Send a GIF"
								icon={<GifGlyph />}
								class={toolButtonClass}
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
									length={text().length}
									max={max()}
									threshold={props.ringThreshold}
								/>
							</span>
						</Show>
						<IconButton
							variant="ghost"
							label="Add an emoji"
							icon={<SmileCircleIcon />}
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
										length={text().length}
										max={max()}
										threshold={props.ringThreshold}
									/>
								</span>
							}
						>
							<button
								type="button"
								aria-label="Send message"
								disabled={!canSend()}
								data-active={canSend() || undefined}
								data-send-button=""
								onMouseDown={(event) => event.preventDefault()}
								onClick={send}
								class={cx(
									"pressable focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border",
									"border-transparent bg-muted text-muted-foreground disabled:cursor-default",
									"data-active:border-primary-highlight data-active:bg-primary data-active:text-primary-foreground",
									"[&_svg]:pointer-events-none",
								)}
							>
								<AnimatedSendIcon
									size={20}
									ref={(handle) => {
										sendIcon = handle;
									}}
								/>
							</button>
						</Show>
					</div>
				</Show>
			</div>
		</div>
	);
};
