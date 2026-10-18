import type { TimestampStyle } from "@colibri-social/lib";
import * as chrono from "chrono-node";
import {
	createMemo,
	createSignal,
	createUniqueId,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { formatTimestamp } from "../../utils/rich-text/format-timestamp";
import type { TimeAttrs } from "./types";

const TIME_STYLES: TimestampStyle[] = [
	"relative",
	"time-short",
	"time-long",
	"date-short",
	"date-long",
	"datetime-short",
	"datetime-long",
];

const STYLE_LABELS: Record<TimestampStyle, string> = {
	relative: "Relative",
	"time-short": "Short time",
	"time-long": "Long time",
	"date-short": "Short date",
	"date-long": "Long date",
	"datetime-short": "Short date and time",
	"datetime-long": "Long date and time",
};

export type TimePickerProps = {
	now?: () => Date;
	onPick: (attrs: TimeAttrs) => void;
	onCancel: () => void;
	onDismiss: () => void;
};

export const TimePicker = (props: TimePickerProps) => {
	const id = createUniqueId();
	const [query, setQuery] = createSignal("");
	const [selected, setSelected] = createSignal(0);
	const now = () => props.now?.() ?? new Date();

	let root!: HTMLDivElement;
	let input!: HTMLInputElement;

	onMount(() => {
		input.focus({ preventScroll: true });
		const onPointerDown = (event: PointerEvent) => {
			if (!root.contains(event.target as Node)) props.onDismiss();
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		onCleanup(() =>
			document.removeEventListener("pointerdown", onPointerDown, true),
		);
	});

	const parsed = createMemo<Date | null>(() => {
		const value = query().trim();
		const reference = now();
		if (!value) return reference;
		return chrono.parseDate(value, reference);
	});

	const options = createMemo(() => {
		const date = parsed();
		if (!date) return [];
		const datetime = date.toISOString();
		const reference = now();
		return TIME_STYLES.map((style) => ({
			style,
			datetime,
			preview: formatTimestamp(datetime, style, reference),
		}));
	});

	const confirm = (index = selected()) => {
		const option = options()[index];
		if (!option) return;
		props.onPick({
			label: option.preview,
			type: "time",
			datetime: option.datetime,
			style: option.style,
		});
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const count = options().length;
		switch (event.key) {
			case "ArrowDown":
				if (!count) return;
				event.preventDefault();
				setSelected((index) => (index + 1) % count);
				break;
			case "ArrowUp":
				if (!count) return;
				event.preventDefault();
				setSelected((index) => (index - 1 + count) % count);
				break;
			case "Enter":
			case "Tab":
				if (event.isComposing) return;
				event.preventDefault();
				confirm();
				break;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				props.onCancel();
				break;
		}
	};

	return (
		<div ref={root} data-time-picker="" class="flex flex-col gap-1 p-1">
			<input
				ref={input}
				value={query()}
				aria-label="When"
				role="combobox"
				aria-expanded="true"
				aria-controls={`${id}-list`}
				aria-activedescendant={
					options().length ? `${id}-option-${selected()}` : undefined
				}
				autocomplete="off"
				enterkeyhint="done"
				onInput={(event) => {
					setQuery(event.currentTarget.value);
					setSelected(0);
				}}
				onKeyDown={onKeyDown}
				placeholder="Tomorrow at 3pm, in two days, Jan 26"
				class={cx(
					"h-9 w-full rounded-control border border-control-border bg-background px-3 text-sm text-foreground outline-none",
					"placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
				)}
			/>
			<Show
				when={options().length > 0}
				fallback={
					<p class="px-2 py-2 text-sm text-muted-foreground" role="status">
						That doesn't look like a time.
					</p>
				}
			>
				<p class="eyebrow px-2 pt-1.5 pb-1">Time formats</p>
				<div id={`${id}-list`} role="listbox" aria-label="Time formats">
					<For each={options()}>
						{(option, index) => (
							<div
								id={`${id}-option-${index()}`}
								role="option"
								tabIndex={-1}
								aria-selected={index() === selected()}
								data-active={index() === selected() || undefined}
								data-time-style={option.style}
								onPointerDown={(event) => event.preventDefault()}
								onPointerMove={() => setSelected(index())}
								onClick={() => confirm(index())}
								class="flex h-9 cursor-pointer items-center justify-between gap-4 rounded-control-sm px-2 data-active:bg-popover-highlight"
							>
								<span class="truncate text-sm text-foreground">
									{option.preview}
								</span>
								<span class="shrink-0 text-xs text-muted-foreground">
									{STYLE_LABELS[option.style]}
								</span>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
};
