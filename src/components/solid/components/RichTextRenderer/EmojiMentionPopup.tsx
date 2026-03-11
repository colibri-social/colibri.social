import twemoji from "@twemoji/api";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import type { searchEmoji } from "./emojiData";

export type EmojiMentionState = {
	query: string;
	top: number;
	left: number;
	colonCharOffset: number;
};

type EmojiResult = ReturnType<typeof searchEmoji>[number];

/**
 * Renders a single emoji character as a twemoji image, the same way the
 * rich-text renderer does it.  We use a ref + effect so twemoji.parse()
 * can replace the raw Unicode glyph with an <img> tag.
 */
const TwemojiChar: Component<{ emoji: string; class?: string }> = (props) => {
	let ref: HTMLSpanElement | undefined;

	createEffect(
		on(
			() => props.emoji,
			() => {
				if (ref) {
					ref.textContent = props.emoji;
					twemoji.parse(ref);
				}
			},
		),
	);

	return (
		<span
			ref={ref}
			class={props.class}
			innerHTML={twemoji.parse(props.emoji)}
		/>
	);
};

export const EmojiMentionPopup: Component<{
	state: Accessor<EmojiMentionState | null>;
	results: Accessor<Array<EmojiResult>>;
	onSelect: (entry: EmojiResult) => void;
	onDismiss: () => void;
}> = (props) => {
	const [selectedIndex, setSelectedIndex] = createSignal(0);

	// Reset selection whenever the result list changes.
	createEffect(
		on(
			() => props.results().length,
			() => setSelectedIndex(0),
		),
	);

	// Also reset when query changes.
	createEffect(
		on(
			() => props.state()?.query,
			() => setSelectedIndex(0),
		),
	);

	const handleKeyDown = (e: KeyboardEvent) => {
		const s = props.state();
		if (!s) return;

		const items = props.results();

		if (e.key === "ArrowDown") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			e.stopPropagation();
			const item = items[selectedIndex()];
			if (item) {
				props.onSelect(item);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			props.onDismiss();
		}
	};

	createEffect(() => {
		if (props.state()) {
			document.addEventListener("keydown", handleKeyDown, true);
		} else {
			document.removeEventListener("keydown", handleKeyDown, true);
		}
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown, true);
	});

	return (
		<Show when={props.state()}>
			{(state) => (
				<Show when={props.results().length > 0}>
					<div
						class="absolute z-50 min-w-64 max-w-80 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-lg py-1"
						style={{
							bottom: `${window.innerHeight - state().top + 8}px`,
							left: `${state().left}px`,
							position: "fixed",
						}}
					>
						<For each={props.results()}>
							{(entry, index) => (
								<button
									type="button"
									class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-3 cursor-pointer hover:bg-muted/50"
									classList={{
										"bg-muted": index() === selectedIndex(),
									}}
									onMouseDown={(e) => {
										e.preventDefault();
										props.onSelect(entry);
									}}
									onMouseEnter={() => setSelectedIndex(index())}
								>
									<span class="shrink-0 w-5 h-5 flex items-center justify-center [&_img]:w-5 [&_img]:h-5">
										<TwemojiChar emoji={entry.emoji} />
									</span>
									<span class="truncate text-muted-foreground">
										:{entry.name}:
									</span>
								</button>
							)}
						</For>
					</div>
				</Show>
			)}
		</Show>
	);
};
