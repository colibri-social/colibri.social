import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { createScrollFade } from "../../../../hooks/createScrollFade";
import { cx } from "../../../../utils/cva";
import { twemojiImageSrc } from "../../../../utils/emoji";
import {
	EMOJI_DATA_RECORD,
	EMOJI_GROUPS,
	type PickerEmoji,
	searchEmojis,
} from "../../../../utils/emoji-data";
import { type EmojiUsage, topEmoji } from "../../../../utils/emoji-usage";
import { TextField, TextFieldInput } from "../../../ui/TextField";

const SEARCH_LIMIT = 96;

const FREQUENT_COUNT = 16;

const CELL_SIZE = 36;

const TITLE_SIZE = 28;

const FALLBACK_COLUMNS = 8;

const VARIATION_SELECTOR = "️";

type Section = {
	title: string;
	emojis: PickerEmoji[];
};

const emojiFor = (char: string): PickerEmoji | undefined => {
	const direct = EMOJI_DATA_RECORD[char];
	if (direct) return direct;
	const toggled = char.endsWith(VARIATION_SELECTOR)
		? char.slice(0, -1)
		: `${char}${VARIATION_SELECTOR}`;
	return EMOJI_DATA_RECORD[toggled];
};

const definedEmoji = (emoji: PickerEmoji | undefined): emoji is PickerEmoji =>
	emoji !== undefined;

const EmojiImage: Component<{ emoji: PickerEmoji }> = (props) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<Show
			when={!failed()}
			fallback={<span class="emoji-render text-2xl">{props.emoji.emoji}</span>}
		>
			<img
				src={twemojiImageSrc(props.emoji.emoji)}
				alt={props.emoji.name}
				class="pointer-events-none h-6 w-6"
				loading="lazy"
				decoding="async"
				onError={() => setFailed(true)}
			/>
		</Show>
	);
};

export const EmojiGrid: Component<{
	onEmoji: (emoji: PickerEmoji, event: MouseEvent) => void;
	usage?: Record<string, EmojiUsage>;
	edgeFade?: boolean;
	heightClass?: string;
}> = (props) => {
	const [query, setQuery] = createSignal("");
	const [columns, setColumns] = createSignal(FALLBACK_COLUMNS);
	const [active, setActive] = createSignal(0);
	const [measureEl, setMeasureEl] = createSignal<HTMLElement>();
	const { ref: scrollRef, canScrollDown } = createScrollFade();

	let cellRefs: (HTMLButtonElement | undefined)[] = [];

	const trimmed = createMemo(() => query().trim());

	const sections = createMemo<Section[]>(() => {
		const search = trimmed();

		if (search) {
			const emojis = searchEmojis(search, SEARCH_LIMIT, props.usage)
				.map((result) => emojiFor(result.emoji))
				.filter(definedEmoji);
			return [{ title: "Search results", emojis }];
		}

		const groups = EMOJI_GROUPS.map((group) => ({
			title: group.name,
			emojis: group.emojis,
		}));

		const frequent = topEmoji(props.usage ?? {}, FREQUENT_COUNT)
			.map(emojiFor)
			.filter(definedEmoji);

		if (frequent.length === 0) return groups;

		return [{ title: "Frequently used", emojis: frequent }, ...groups];
	});

	const flat = createMemo(() => {
		const starts: number[] = [];
		const owners: number[] = [];

		for (const [index, section] of sections().entries()) {
			starts.push(owners.length);
			for (let i = 0; i < section.emojis.length; i++) owners.push(index);
		}

		return { starts, owners, total: owners.length };
	});

	createEffect(() => {
		flat();
		cellRefs = [];
		setActive(0);
	});

	createEffect(() => {
		const node = measureEl();
		if (!node) return;

		const update = () => {
			const count = getComputedStyle(node)
				.gridTemplateColumns.split(" ")
				.filter(Boolean).length;
			if (count > 0) setColumns(count);
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(node);
		onCleanup(() => observer.disconnect());
	});

	const focusCell = (index: number) => {
		const { total } = flat();
		if (total === 0) return;
		const next = Math.max(0, Math.min(total - 1, index));
		setActive(next);
		cellRefs[next]?.focus();
	};

	const moveRow = (direction: 1 | -1) => {
		const { starts, owners } = flat();
		const section = owners[active()];
		if (section === undefined) return;

		const step = columns();
		const start = starts[section];
		const length = sections()[section].emojis.length;
		const offset = active() - start;
		const target = offset + direction * step;

		if (target >= 0 && target < length) {
			focusCell(start + target);
			return;
		}

		const neighbour = section + direction;
		if (neighbour < 0 || neighbour >= sections().length) return;

		const column = offset % step;
		const neighbourStart = starts[neighbour];
		const neighbourLength = sections()[neighbour].emojis.length;

		if (direction === 1) {
			focusCell(neighbourStart + Math.min(column, neighbourLength - 1));
			return;
		}

		const lastRowStart = Math.floor((neighbourLength - 1) / step) * step;
		focusCell(
			neighbourStart + Math.min(lastRowStart + column, neighbourLength - 1),
		);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		switch (event.key) {
			case "ArrowRight":
				event.preventDefault();
				focusCell(active() + 1);
				return;
			case "ArrowLeft":
				event.preventDefault();
				focusCell(active() - 1);
				return;
			case "ArrowDown":
				event.preventDefault();
				moveRow(1);
				return;
			case "ArrowUp":
				event.preventDefault();
				moveRow(-1);
				return;
			case "Home":
				event.preventDefault();
				focusCell(0);
				return;
			case "End":
				event.preventDefault();
				focusCell(flat().total - 1);
				return;
			default:
		}
	};

	const intrinsicSize = (count: number) =>
		`auto ${Math.ceil(count / columns()) * CELL_SIZE + TITLE_SIZE}px`;

	return (
		<>
			<TextField class="mb-2 shrink-0" value={query()} onChange={setQuery}>
				<TextFieldInput
					type="text"
					placeholder="Search emojis..."
					class="h-9"
				/>
			</TextField>

			<div class={cx("relative", props.heightClass ?? "h-72")}>
				<div ref={scrollRef} class="h-full overflow-y-auto">
					<div class="emoji-picker" onKeyDown={onKeyDown}>
						<For each={sections()}>
							{(section, sectionIndex) => (
								<section
									class="emoji-section"
									style={{
										"content-visibility": "auto",
										"contain-intrinsic-size": intrinsicSize(
											section.emojis.length,
										),
									}}
								>
									<span class="emoji-section-title">{section.title}</span>
									<div
										ref={(node) => {
											if (sectionIndex() === 0) setMeasureEl(node);
										}}
										class="emoji-items"
									>
										<For each={section.emojis}>
											{(emoji, emojiIndex) => {
												const index = () =>
													flat().starts[sectionIndex()] + emojiIndex();
												return (
													<button
														ref={(node) => {
															cellRefs[index()] = node;
														}}
														type="button"
														title={emoji.name}
														tabIndex={active() === index() ? 0 : -1}
														class="emoji-button cursor-pointer rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
														onClick={(event) => {
															setActive(index());
															props.onEmoji(emoji, event);
														}}
														onFocus={() => setActive(index())}
													>
														<EmojiImage emoji={emoji} />
													</button>
												);
											}}
										</For>
									</div>
								</section>
							)}
						</For>

						<Show when={flat().total === 0}>
							<p class="py-6 text-center text-sm text-muted-foreground">
								No emoji found for "{trimmed()}"
							</p>
						</Show>
					</div>
				</div>

				<Show when={props.edgeFade}>
					<div
						class="scroll-edge-fade pointer-events-none absolute inset-x-0 bottom-0 h-4 transition-opacity duration-150"
						classList={{ "opacity-0": !canScrollDown() }}
						aria-hidden="true"
					/>
				</Show>
			</div>
		</>
	);
};
