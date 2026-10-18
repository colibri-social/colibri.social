import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import type { EmojiUsage } from "../../utils/emoji-usage";
import { utf8Length } from "../../utils/text-length";
import {
	CharacterRing,
	characterRingSlotClass,
} from "../Composer/CharacterRing";
import { EmojiPickerPopover } from "../EmojiPicker/EmojiPickerPopover";
import type { SkinTone } from "../EmojiPicker/skin-tone";
import { IconButton } from "../IconButton/IconButton";
import { ListGroup, ToggleRow } from "../List/List";
import { Select, type SelectOption } from "../Select/Select";
import { TextField } from "../TextField/TextField";

export const STATUS_TEXT_MAX_BYTES = 64;
export const STATUS_RING_THRESHOLD = 0.75;

export type StatusClearAfter = "never" | "30m" | "1h" | "4h" | "today" | "week";

export const STATUS_CLEAR_AFTER_OPTIONS: SelectOption[] = [
	{ value: "never", label: "Don't clear" },
	{ value: "30m", label: "30 minutes" },
	{ value: "1h", label: "1 hour" },
	{ value: "4h", label: "4 hours" },
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
];

export type StatusDraft = {
	text: string;
	emoji?: string;
	clearAfter: StatusClearAfter;
	showWhileOffline?: boolean;
};

export type StatusChange = StatusDraft & { expiresAt?: string };

const MINUTE = 60_000;

const RELATIVE_MINUTES: Partial<Record<StatusClearAfter, number>> = {
	"30m": 30,
	"1h": 60,
	"4h": 240,
};

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const statusExpiresAt = (
	clearAfter: StatusClearAfter,
	now: Date = new Date(),
): Date | undefined => {
	const minutes = RELATIVE_MINUTES[clearAfter];
	if (minutes !== undefined) return new Date(now.getTime() + minutes * MINUTE);
	if (clearAfter === "today") return addDays(startOfDay(now), 1);
	if (clearAfter === "week") {
		const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
		return addDays(startOfDay(now), daysUntilMonday);
	}
	return undefined;
};

const graphemes = (text: string): string[] => {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(text), (part) => part.segment);
	}
	return Array.from(text);
};

export const clampToBytes = (text: string, maxBytes: number) => {
	if (utf8Length(text) <= maxBytes) return text;
	let kept = "";
	let used = 0;
	for (const grapheme of graphemes(text)) {
		const size = utf8Length(grapheme);
		if (used + size > maxBytes) break;
		kept += grapheme;
		used += size;
	}
	return kept;
};

export type StatusFieldProps = {
	platform?: "desktop" | "mobile";
	value?: StatusDraft;
	defaultValue?: Partial<StatusDraft>;
	onChange?: (change: StatusChange) => void;
	maxBytes?: number;
	label?: JSX.Element;
	placeholder?: string;
	clearAfterLabel?: JSX.Element;
	showWhileOfflineLabel?: JSX.Element;
	showWhileOfflineDescription?: JSX.Element;
	usage?: Record<string, EmojiUsage>;
	skinTone?: SkinTone;
	onSkinToneChange?: (tone: SkinTone) => void;
	now?: () => Date;
	disabled?: boolean;
	class?: string;
};

export const StatusField = (props: StatusFieldProps) => {
	const [internal, setInternal] = createSignal<StatusDraft>({
		text: props.defaultValue?.text ?? "",
		emoji: props.defaultValue?.emoji,
		clearAfter: props.defaultValue?.clearAfter ?? "never",
		showWhileOffline: props.defaultValue?.showWhileOffline ?? false,
	});
	const [pickerOpen, setPickerOpen] = createSignal(false);
	const draft = () => props.value ?? internal();
	const maxBytes = () => props.maxBytes ?? STATUS_TEXT_MAX_BYTES;
	const bytes = () => utf8Length(draft().text);
	const ringVisible = () => bytes() / maxBytes() >= STATUS_RING_THRESHOLD;
	const hasDraft = () => draft().text.length > 0 || !!draft().emoji;
	let input: HTMLInputElement | undefined;

	const commit = (next: StatusDraft) => {
		setInternal(next);
		const expiresAt = statusExpiresAt(
			next.clearAfter,
			props.now?.() ?? new Date(),
		);
		props.onChange?.({
			...next,
			showWhileOffline: next.showWhileOffline ?? false,
			expiresAt: expiresAt?.toISOString(),
		});
	};

	const onText = (text: string) => {
		const clamped = clampToBytes(text, maxBytes());
		if (clamped !== text && input) input.value = clamped;
		commit({ ...draft(), text: clamped });
	};

	const clear = () => {
		commit({ ...draft(), text: "", emoji: undefined });
		input?.focus();
	};

	const emojiButton = (
		<IconButton
			variant="ghost"
			size="sm"
			disabled={props.disabled}
			label={
				draft().emoji
					? `Status emoji ${draft().emoji}`
					: "Choose a status emoji"
			}
			aria-haspopup="dialog"
			aria-expanded={pickerOpen()}
			onClick={() => setPickerOpen((open) => !open)}
			class="-ml-1.5 text-muted-foreground"
			icon={
				<Show when={draft().emoji} fallback={<SmileCircleIcon />}>
					{(emoji) => (
						<span
							data-status-emoji=""
							class="text-lg leading-none text-foreground"
						>
							{emoji()}
						</span>
					)}
				</Show>
			}
		/>
	);

	return (
		<div
			data-status-field=""
			class={cx("flex w-full flex-col gap-4", props.class)}
		>
			<TextField
				label={props.label ?? "Status"}
				placeholder={props.placeholder ?? "What are you up to?"}
				value={draft().text}
				onChange={onText}
				disabled={props.disabled}
				autocomplete="off"
				ref={(element) => {
					input = element;
				}}
				leading={
					<EmojiPickerPopover
						open={pickerOpen()}
						onOpenChange={setPickerOpen}
						platform={props.platform}
						placement="bottom-start"
						label="Status emoji"
						anchor={emojiButton}
						usage={props.usage}
						skinTone={props.skinTone}
						onSkinToneChange={props.onSkinToneChange}
						onPick={(pick) => {
							if (pick.kind !== "unicode") return;
							commit({ ...draft(), emoji: pick.emoji });
						}}
					/>
				}
				trailing={
					<span class="flex items-center gap-1">
						<span
							data-ring-slot=""
							data-visible={ringVisible() || undefined}
							class={characterRingSlotClass}
						>
							<CharacterRing
								length={bytes()}
								max={maxBytes()}
								threshold={STATUS_RING_THRESHOLD}
							/>
						</span>
						<button
							type="button"
							aria-label="Clear status"
							disabled={!hasDraft() || props.disabled}
							onClick={clear}
							class={cx(
								"focus-ring flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground",
								"transition-[opacity,scale] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)]",
								"motion-reduce:transition-none reduced-motion:transition-none",
								hasDraft()
									? "scale-100 opacity-100"
									: "pointer-events-none invisible scale-75 opacity-0",
							)}
						>
							<CloseCircleIcon size={18} />
						</button>
					</span>
				}
			/>
			<Select
				platform={props.platform}
				label={props.clearAfterLabel ?? "Clear after"}
				options={STATUS_CLEAR_AFTER_OPTIONS}
				value={draft().clearAfter}
				disabled={props.disabled}
				onChange={(value) =>
					commit({ ...draft(), clearAfter: value as StatusClearAfter })
				}
			/>
			<ListGroup>
				<ToggleRow
					title={props.showWhileOfflineLabel ?? "Show while offline"}
					description={
						props.showWhileOfflineDescription ??
						"Others see your status even when you're offline."
					}
					checked={draft().showWhileOffline ?? false}
					disabled={props.disabled}
					onChange={(showWhileOffline) =>
						commit({ ...draft(), showWhileOffline })
					}
				/>
			</ListGroup>
		</div>
	);
};

export { utf8Length };
