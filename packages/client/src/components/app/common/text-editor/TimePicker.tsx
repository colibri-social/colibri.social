import type { TimestampStyle } from "@colibri-social/lib";
import type { Editor } from "@tiptap/core";
import * as chrono from "chrono-node";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { formatTimestamp } from "../../../../utils/format-timestamp";

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
	"datetime-short": "Short date & time",
	"datetime-long": "Long date & time",
};

/**
 * Discord-style timestamp picker shown when the user types `@time`. Takes a
 * natural-language query (e.g. "tomorrow at 3pm", "in two days", "Jan 26
 * 2027"), resolves it against the viewer's local time via chrono-node, and
 * offers each display style with a live preview. The chosen option is inserted
 * as a time mention whose stored datetime is UTC, so other clients resolve it
 * back into their own local time (and live-update if relative).
 */
export const TimePicker: Component<{
	editor: Editor;
	range: { from: number; to: number };
	command: (attrs: {
		label: string;
		type: "time";
		datetime: string;
		style: TimestampStyle;
	}) => void;
}> = (props) => {
	const [query, setQuery] = createSignal("");
	const [selected, setSelected] = createSignal(0);

	let root!: HTMLDivElement;
	let input!: HTMLInputElement;

	onMount(() => {
		// Moving focus here blurs the editor, but the tiptap suggestion stays
		// active because blur dispatches no transaction — so the picker survives.
		input.focus();

		const onDocMouseDown = (e: MouseEvent) => {
			if (!root.contains(e.target as Node)) cancel();
		};
		document.addEventListener("mousedown", onDocMouseDown);
		onCleanup(() => document.removeEventListener("mousedown", onDocMouseDown));
	});

	// Resolve the query to a concrete instant. Empty falls back to "now" so the
	// picker is useful immediately; an unparseable query yields null.
	const parsedDate = createMemo<Date | null>(() => {
		const q = query().trim();
		if (!q) return new Date();
		return chrono.parseDate(q, new Date());
	});

	const options = createMemo(() => {
		const date = parsedDate();
		if (!date) return [];
		const datetime = date.toISOString();
		return TIME_STYLES.map((style) => ({
			style,
			datetime,
			preview: formatTimestamp(datetime, style, new Date()),
		}));
	});

	const confirm = () => {
		const option = options()[selected()];
		if (!option) return;
		props.command({
			label: option.preview,
			type: "time",
			datetime: option.datetime,
			style: option.style,
		});
	};

	const cancel = () => {
		// Remove the `@time` trigger text and hand focus back to the editor; the
		// suggestion deactivates once its match is gone, tearing down this popup.
		props.editor.chain().focus().deleteRange(props.range).run();
	};

	const onKeyDown = (e: KeyboardEvent) => {
		const count = options().length;
		switch (e.key) {
			case "ArrowDown":
				if (!count) return;
				e.preventDefault();
				setSelected((i) => (i + 1) % count);
				break;
			case "ArrowUp":
				if (!count) return;
				e.preventDefault();
				setSelected((i) => (i - 1 + count) % count);
				break;
			case "Enter":
			case "Tab":
				e.preventDefault();
				confirm();
				break;
			case "Escape":
				e.preventDefault();
				cancel();
				break;
		}
	};

	return (
		<div
			ref={root}
			class="flex flex-col gap-2 border border-border bg-card rounded-md drop-shadow-black drop-shadow-sm overflow-hidden p-2"
		>
			<input
				ref={input}
				value={query()}
				onInput={(e) => {
					setQuery(e.currentTarget.value);
					setSelected(0);
				}}
				onKeyDown={onKeyDown}
				placeholder="e.g. tomorrow at 3pm, in two days, Jan 26 2027"
				class="bg-muted/40 border border-border rounded-sm px-2 py-1 text-sm outline-none focus:border-neutral-500"
			/>
			<Show
				when={options().length > 0}
				fallback={
					<div class="text-muted-foreground text-sm mx-1 py-1">
						Couldn't understand that time
					</div>
				}
			>
				<span class="text-xs text-muted-foreground">TIME FORMATS</span>
				<div class="flex flex-col">
					<For each={options()}>
						{(option, index) => (
							<button
								type="button"
								class="flex flex-row items-center justify-between gap-4 px-2 py-1 rounded-sm text-left"
								classList={{ "bg-muted": index() === selected() }}
								onClick={() => {
									setSelected(index());
									confirm();
								}}
								onMouseEnter={() => setSelected(index())}
							>
								<span class="text-sm">{option.preview}</span>
								<span class="text-xs text-muted-foreground">
									{STYLE_LABELS[option.style]}
								</span>
							</button>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
};
