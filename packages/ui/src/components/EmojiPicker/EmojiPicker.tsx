import { BasketballIcon } from "@solar-icons/solid/bold/basketball";
import { BusIcon } from "@solar-icons/solid/bold/bus";
import { ClockCircleIcon } from "@solar-icons/solid/bold/clock-circle";
import { DonutIcon } from "@solar-icons/solid/bold/donut";
import { FlagIcon } from "@solar-icons/solid/bold/flag";
import { HandShakeIcon } from "@solar-icons/solid/bold/hand-shake";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { LightbulbIcon } from "@solar-icons/solid/bold/lightbulb";
import { MagnifierIcon } from "@solar-icons/solid/bold/magnifier";
import { PawIcon } from "@solar-icons/solid/bold/paw";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSX,
	Match,
	on,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import {
	aliasesForSlug,
	EMOJI_DATA_RECORD,
	EMOJI_GROUPS,
	type PickerEmoji,
	searchEmojis,
} from "../../utils/emoji-data";
import { type EmojiUsage, topEmoji } from "../../utils/emoji-usage";
import { foldText } from "../../utils/fold-text";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { SearchField } from "../TextField/TextField";
import {
	applySkinTone,
	SKIN_TONE_SAMPLE,
	SKIN_TONES,
	type SkinTone,
	skinToneLabels,
	stripSkinTone,
} from "./skin-tone";

export type EmojiPickerPlatform = "mobile" | "desktop";

export type CustomEmoji = {
	id: string;
	name: string;
	src: string;
};

export type EmojiPack = {
	id: string;
	name: string;
	author?: string;
	emojis: CustomEmoji[];
};

export type EmojiPick =
	| { kind: "unicode"; emoji: string; shortcode: string }
	| { kind: "custom"; emoji: CustomEmoji; pack: EmojiPack };

export type EmojiPickerProps = {
	platform?: EmojiPickerPlatform;
	onPick: (pick: EmojiPick, event: MouseEvent) => void;
	usage?: Record<string, EmojiUsage>;
	packs?: EmojiPack[];
	skinTone?: SkinTone;
	onSkinToneChange?: (tone: SkinTone) => void;
	autofocus?: boolean;
	searchPlaceholder?: string;
	class?: string;
};

type Item = {
	key: string;
	label: string;
	shortcode: string;
	char?: string;
	custom?: CustomEmoji;
	pack?: EmojiPack;
};

type Section = {
	id: string;
	title: string;
	byline?: string;
	icon: () => JSX.Element;
	items: Item[];
};

const FREQUENT_COUNT = 16;
const SEARCH_LIMIT = 96;
const SECTION_TITLE_PX = 32;
const INITIAL_SECTIONS = 2;
const VARIATION_SELECTOR = "️";

const metrics = {
	desktop: { cell: 40, glyph: "text-[26px]", image: "size-[26px]", columns: 8 },
	mobile: { cell: 46, glyph: "text-[30px]", image: "size-[30px]", columns: 7 },
} as const;

const groupIcons: Record<string, () => JSX.Element> = {
	"Smileys & Emotion": () => <SmileCircleIcon />,
	"People & Body": () => <HandShakeIcon />,
	"Animals & Nature": () => <PawIcon />,
	"Food & Drink": () => <DonutIcon />,
	"Travel & Places": () => <BusIcon />,
	Activities: () => <BasketballIcon />,
	Objects: () => <LightbulbIcon />,
	Symbols: () => <HeartIcon />,
	Flags: () => <FlagIcon />,
};

const metaFor = (char: string): PickerEmoji | undefined => {
	const base = stripSkinTone(char);
	const direct = EMOJI_DATA_RECORD[base];
	if (direct) return direct;
	const toggled = base.endsWith(VARIATION_SELECTOR)
		? base.slice(0, -1)
		: `${base}${VARIATION_SELECTOR}`;
	return EMOJI_DATA_RECORD[toggled];
};

const shortcodeFor = (emoji: PickerEmoji) =>
	aliasesForSlug(emoji.slug)[0] ?? emoji.slug;

const unicodeItem = (emoji: PickerEmoji, tone: SkinTone, shown?: string) => {
	const char =
		shown ??
		(emoji.skin_tone_support ? applySkinTone(emoji.emoji, tone) : emoji.emoji);
	return {
		key: char,
		label: emoji.name,
		shortcode: shortcodeFor(emoji),
		char,
	} satisfies Item;
};

const customItem = (emoji: CustomEmoji, pack: EmojiPack): Item => ({
	key: `custom:${pack.id}:${emoji.id}`,
	label: emoji.name,
	shortcode: emoji.name,
	custom: emoji,
	pack,
});

const CustomGlyph = (props: { emoji: CustomEmoji; class: string }) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<Show
			when={!failed()}
			fallback={
				<span class="max-w-full truncate px-0.5 text-[10px] font-semibold text-muted-foreground">
					:{props.emoji.name}:
				</span>
			}
		>
			<AnimatedImage
				src={props.emoji.src}
				alt=""
				draggable={false}
				loading="lazy"
				decoding="async"
				onError={() => setFailed(true)}
				class={cx("pointer-events-none object-contain", props.class)}
			/>
		</Show>
	);
};

const PackIcon = (props: { pack: EmojiPack }) => (
	<Show when={props.pack.emojis[0]} fallback={<SmileCircleIcon />} keyed>
		{(emoji) => <CustomGlyph emoji={emoji} class="size-4" />}
	</Show>
);

export const EmojiPicker = (props: EmojiPickerProps) => {
	const platform = () => props.platform ?? "desktop";
	const sizes = () => metrics[platform()];
	const tone = () => props.skinTone ?? 0;

	const [query, setQuery] = createSignal("");
	const [columns, setColumns] = createSignal<number>(metrics.desktop.columns);
	const [active, setActive] = createSignal(0);
	const [preview, setPreview] = createSignal<Item>();
	const [visibleSection, setVisibleSection] = createSignal<string>();
	const [mounted, setMounted] = createSignal<ReadonlySet<string>>(new Set());
	const [toneOpen, setToneOpen] = createSignal(false);
	const toneListId = createUniqueId();

	let scroller: HTMLDivElement | undefined;
	let searchInput: HTMLInputElement | undefined;
	let toneButton: HTMLButtonElement | undefined;
	const sectionElements = new Map<string, HTMLElement>();

	const trimmed = createMemo(() => query().trim());

	const browseSections = createMemo<Section[]>(() => {
		const currentTone = tone();
		const frequent: Item[] = [];
		const seen = new Set<string>();
		for (const char of topEmoji(props.usage ?? {}, FREQUENT_COUNT)) {
			const meta = metaFor(char);
			if (!meta) continue;
			const item = unicodeItem(
				meta,
				currentTone,
				stripSkinTone(char) === char ? undefined : char,
			);
			if (seen.has(item.key)) continue;
			seen.add(item.key);
			frequent.push(item);
		}
		const sections: Section[] = [];
		if (frequent.length > 0) {
			sections.push({
				id: "frequent",
				title: "Frequently used",
				icon: () => <ClockCircleIcon />,
				items: frequent,
			});
		}
		for (const pack of props.packs ?? []) {
			if (pack.emojis.length === 0) continue;
			sections.push({
				id: `pack:${pack.id}`,
				title: pack.name,
				byline: pack.author ? `· by @${pack.author}` : undefined,
				icon: () => <PackIcon pack={pack} />,
				items: pack.emojis.map((emoji) => customItem(emoji, pack)),
			});
		}
		for (const group of EMOJI_GROUPS) {
			sections.push({
				id: group.slug,
				title: group.name,
				icon: groupIcons[group.name] ?? (() => <SmileCircleIcon />),
				items: group.emojis.map((emoji) => unicodeItem(emoji, currentTone)),
			});
		}
		return sections;
	});

	const searchSections = createMemo<Section[]>(() => {
		const search = trimmed();
		if (!search) return [];
		const folded = foldText(search).replace(/^:|:$/g, "");
		const items: Item[] = [];
		for (const pack of props.packs ?? []) {
			for (const emoji of pack.emojis) {
				if (foldText(emoji.name).includes(folded))
					items.push(customItem(emoji, pack));
			}
		}
		for (const result of searchEmojis(folded, SEARCH_LIMIT, props.usage)) {
			const meta = metaFor(result.emoji);
			if (meta) items.push(unicodeItem(meta, tone()));
		}
		return [
			{
				id: "search",
				title: "Search results",
				icon: () => <MagnifierIcon />,
				items,
			},
		];
	});

	const sections = () => (trimmed() ? searchSections() : browseSections());

	const flat = createMemo(() => {
		const starts: number[] = [];
		const owners: number[] = [];
		for (const [index, section] of sections().entries()) {
			starts.push(owners.length);
			for (let item = 0; item < section.items.length; item++)
				owners.push(index);
		}
		return { starts, owners, total: owners.length };
	});

	const itemAt = (index: number) => {
		const { starts, owners } = flat();
		const owner = owners[index];
		if (owner === undefined) return undefined;
		return sections()[owner]?.items[index - starts[owner]];
	};

	const mountSection = (id: string) => {
		if (mounted().has(id)) return;
		setMounted((current) => new Set(current).add(id));
	};

	createEffect(
		on(trimmed, () => {
			const list = sections();
			batch(() => {
				setActive(0);
				setPreview(list[0]?.items[0]);
				setVisibleSection(list[0]?.id);
				setMounted(
					new Set(list.slice(0, INITIAL_SECTIONS).map((section) => section.id)),
				);
			});
			if (scroller) scroller.scrollTop = 0;
		}),
	);

	onMount(() => {
		if (!scroller) return;
		const element = scroller;
		const measure = () => {
			const width = element.clientWidth - 8;
			if (width <= 0) return;
			setColumns(Math.max(1, Math.floor(width / sizes().cell)));
		};
		measure();
		const resize = new ResizeObserver(measure);
		resize.observe(element);
		const intersection = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const id = (entry.target as HTMLElement).dataset.section;
					if (id) mountSection(id);
				}
			},
			{ root: element, rootMargin: "600px 0px" },
		);
		createEffect(() => {
			sections();
			intersection.disconnect();
			queueMicrotask(() => {
				for (const section of sectionElements.values())
					intersection.observe(section);
			});
		});
		onCleanup(() => {
			resize.disconnect();
			intersection.disconnect();
		});
		if (props.autofocus && platform() === "desktop")
			requestAnimationFrame(() => searchInput?.focus());
	});

	let scrollFrame = 0;
	const onScroll = () => {
		if (scrollFrame) return;
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0;
			if (!scroller) return;
			const top = scroller.scrollTop + SECTION_TITLE_PX;
			let current = sections()[0]?.id;
			for (const section of sections()) {
				const element = sectionElements.get(section.id);
				if (!element) continue;
				if (element.offsetTop <= top) current = section.id;
				else break;
			}
			setVisibleSection(current);
		});
	};
	onCleanup(() => cancelAnimationFrame(scrollFrame));

	const jumpTo = (id: string) => {
		const element = sectionElements.get(id);
		mountSection(id);
		setVisibleSection(id);
		if (scroller && element) scroller.scrollTop = element.offsetTop;
		const index = sections().findIndex((section) => section.id === id);
		if (index >= 0) setActive(flat().starts[index]);
	};

	const cellElement = (index: number) =>
		scroller?.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`);

	const focusCell = (index: number) => {
		const { total, owners } = flat();
		if (total === 0) return;
		const next = Math.max(0, Math.min(total - 1, index));
		setActive(next);
		setPreview(itemAt(next));
		const section = sections()[owners[next]];
		if (section) mountSection(section.id);
		const existing = cellElement(next);
		if (existing) {
			existing.focus();
			return;
		}
		queueMicrotask(() => cellElement(next)?.focus());
	};

	const moveRow = (direction: 1 | -1) => {
		const { starts, owners } = flat();
		const owner = owners[active()];
		if (owner === undefined) return;
		const step = columns();
		const start = starts[owner];
		const length = sections()[owner].items.length;
		const offset = active() - start;
		const target = offset + direction * step;
		if (target >= 0 && target < length) {
			focusCell(start + target);
			return;
		}
		const neighbour = owner + direction;
		if (neighbour < 0) {
			searchInput?.focus();
			return;
		}
		if (neighbour >= sections().length) return;
		const column = offset % step;
		const neighbourStart = starts[neighbour];
		const neighbourLength = sections()[neighbour].items.length;
		if (direction === 1) {
			focusCell(neighbourStart + Math.min(column, neighbourLength - 1));
			return;
		}
		const lastRowStart = Math.floor((neighbourLength - 1) / step) * step;
		focusCell(
			neighbourStart + Math.min(lastRowStart + column, neighbourLength - 1),
		);
	};

	const onGridKeyDown = (event: KeyboardEvent) => {
		const keys: Record<string, () => void> = {
			ArrowRight: () => focusCell(active() + 1),
			ArrowLeft: () => focusCell(active() - 1),
			ArrowDown: () => moveRow(1),
			ArrowUp: () => moveRow(-1),
			Home: () => focusCell(0),
			End: () => focusCell(flat().total - 1),
		};
		const handler = keys[event.key];
		if (!handler) return;
		event.preventDefault();
		handler();
	};

	const pick = (item: Item, event: MouseEvent) => {
		if (item.custom && item.pack) {
			props.onPick(
				{ kind: "custom", emoji: item.custom, pack: item.pack },
				event,
			);
			return;
		}
		if (item.char)
			props.onPick(
				{ kind: "unicode", emoji: item.char, shortcode: item.shortcode },
				event,
			);
	};

	const onSearchKeyDown = (event: KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusCell(active());
			return;
		}
		if (event.key === "Enter") {
			const first = itemAt(0);
			if (!first) return;
			event.preventDefault();
			cellElement(0)?.click();
		}
	};

	const chooseTone = (next: SkinTone) => {
		props.onSkinToneChange?.(next);
		setToneOpen(false);
		toneButton?.focus();
	};

	const sectionHeight = (section: Section) =>
		SECTION_TITLE_PX +
		Math.ceil(section.items.length / columns()) * sizes().cell;

	const Cell = (cellProps: { item: Item; index: () => number }) => (
		<button
			type="button"
			data-cell={cellProps.index()}
			data-emoji-key={cellProps.item.key}
			aria-label={
				cellProps.item.custom
					? `:${cellProps.item.shortcode}:`
					: cellProps.item.label
			}
			tabIndex={active() === cellProps.index() ? 0 : -1}
			onClick={(event) => {
				setActive(cellProps.index());
				pick(cellProps.item, event);
			}}
			onFocus={() => {
				setActive(cellProps.index());
				setPreview(cellProps.item);
			}}
			onPointerEnter={(event) => {
				if (event.pointerType === "mouse") setPreview(cellProps.item);
			}}
			class={cx(
				"flex cursor-pointer items-center justify-center rounded-control-sm leading-none outline-none select-none",
				"hover:bg-secondary focus-visible:bg-secondary focus-ring-inset",
				"active:scale-90 transition-transform duration-[calc(120ms*var(--motion-scale))] ease-(--ease-out-quick)",
			)}
			style={{ "scroll-margin-top": `${SECTION_TITLE_PX}px` }}
		>
			<Switch>
				<Match when={cellProps.item.custom}>
					{(custom) => <CustomGlyph emoji={custom()} class={sizes().image} />}
				</Match>
				<Match when={cellProps.item.char}>
					{(char) => (
						<span aria-hidden="true" class={sizes().glyph}>
							{char()}
						</span>
					)}
				</Match>
			</Switch>
		</button>
	);

	return (
		<div
			data-emoji-picker=""
			data-platform={platform()}
			class={cx(
				"flex min-h-0 w-full flex-col",
				platform() === "desktop"
					? "h-[min(420px,calc(var(--anchored-max-height,9999px)-18px))]"
					: "h-[min(60dvh,520px)]",
				props.class,
			)}
		>
			<div class="relative flex shrink-0 items-center gap-2 pb-2">
				<SearchField
					aria-label="Search emoji"
					placeholder={props.searchPlaceholder ?? "Search emoji"}
					value={query()}
					onChange={setQuery}
					onKeyDown={onSearchKeyDown}
					ref={(element) => {
						searchInput = element;
					}}
					class="flex-1"
				/>
				<button
					ref={toneButton}
					type="button"
					aria-label={`Skin tone: ${skinToneLabels[tone()]}`}
					aria-expanded={toneOpen()}
					aria-controls={toneListId}
					onClick={() => setToneOpen((open) => !open)}
					class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control border border-border bg-secondary text-[22px] leading-none outline-none hover:bg-secondary-highlight focus-ring"
				>
					<span aria-hidden="true">
						{applySkinTone(SKIN_TONE_SAMPLE, tone())}
					</span>
				</button>
				<Show when={toneOpen()}>
					<fieldset
						id={toneListId}
						aria-label="Skin tone"
						data-skin-tones=""
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								event.stopPropagation();
								setToneOpen(false);
								toneButton?.focus();
								return;
							}
							const delta =
								event.key === "ArrowRight" || event.key === "ArrowDown"
									? 1
									: event.key === "ArrowLeft" || event.key === "ArrowUp"
										? -1
										: 0;
							if (!delta) return;
							event.preventDefault();
							const buttons = Array.from(
								event.currentTarget.querySelectorAll<HTMLButtonElement>(
									"button",
								),
							);
							const current = buttons.indexOf(
								document.activeElement as HTMLButtonElement,
							);
							buttons[
								(current + delta + buttons.length) % buttons.length
							]?.focus();
						}}
						onFocusOut={(event) => {
							const next = event.relatedTarget as Node | null;
							if (next && event.currentTarget.contains(next)) return;
							if (next === toneButton) return;
							setToneOpen(false);
						}}
						ref={(element) =>
							requestAnimationFrame(() =>
								element
									.querySelector<HTMLButtonElement>("[aria-pressed='true']")
									?.focus(),
							)
						}
						class="modal-motion absolute top-0 right-0 z-20 flex h-10 origin-right items-center gap-0.5 rounded-control border border-border bg-popover p-0.5 shadow-overlay"
					>
						<For each={SKIN_TONES}>
							{(option) => (
								<button
									type="button"
									aria-pressed={tone() === option}
									aria-label={skinToneLabels[option]}
									tabIndex={tone() === option ? 0 : -1}
									onClick={() => chooseTone(option)}
									class={cx(
										"flex size-8 cursor-pointer items-center justify-center rounded-control-sm text-[20px] leading-none outline-none",
										"hover:bg-secondary focus-ring-inset",
										tone() === option && "bg-secondary",
									)}
								>
									<span aria-hidden="true">
										{applySkinTone(SKIN_TONE_SAMPLE, option)}
									</span>
								</button>
							)}
						</For>
					</fieldset>
				</Show>
			</div>

			<Show when={!trimmed()}>
				<nav
					aria-label="Emoji categories"
					class="-mx-1 flex shrink-0 gap-0.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none]"
				>
					<For each={browseSections()}>
						{(section) => (
							<button
								type="button"
								aria-label={section.title}
								aria-current={visibleSection() === section.id || undefined}
								title={platform() === "desktop" ? section.title : undefined}
								onClick={() => jumpTo(section.id)}
								class={cx(
									"flex shrink-0 cursor-pointer items-center justify-center rounded-control-xs outline-none [&_svg]:size-4",
									platform() === "desktop" ? "size-7" : "size-9",
									"focus-ring-inset",
									visibleSection() === section.id
										? "bg-secondary text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{section.icon()}
							</button>
						)}
					</For>
				</nav>
			</Show>

			<div
				ref={scroller}
				data-emoji-scroller=""
				onScroll={onScroll}
				class="ring-room relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div onKeyDown={onGridKeyDown}>
					<For each={sections()}>
						{(section, sectionIndex) => (
							<section
								ref={(element) => {
									sectionElements.set(section.id, element);
									onCleanup(() => {
										if (sectionElements.get(section.id) === element)
											sectionElements.delete(section.id);
									});
								}}
								data-section={section.id}
								aria-label={section.title}
								style={
									mounted().has(section.id)
										? undefined
										: { height: `${sectionHeight(section)}px` }
								}
							>
								<div
									data-section-header=""
									class="sticky top-[calc(var(--focus-ring-reach)*-1)] z-10 flex items-baseline gap-1.5 bg-popover px-1 text-xs font-semibold text-muted-foreground"
									style={{ height: `${SECTION_TITLE_PX}px` }}
								>
									<span class="self-center truncate">{section.title}</span>
									<Show when={section.byline}>
										<span class="self-center truncate font-medium opacity-80">
											{section.byline}
										</span>
									</Show>
								</div>
								<Show when={mounted().has(section.id)}>
									<div
										class="grid"
										style={{
											"grid-template-columns": `repeat(${columns()}, minmax(0, 1fr))`,
											"grid-auto-rows": `${sizes().cell}px`,
										}}
									>
										<For each={section.items}>
											{(item, itemIndex) => (
												<Cell
													item={item}
													index={() =>
														(flat().starts[sectionIndex()] ?? 0) + itemIndex()
													}
												/>
											)}
										</For>
									</div>
								</Show>
							</section>
						)}
					</For>
					<Show when={trimmed() && flat().total === 0}>
						<p
							role="status"
							class="px-4 py-10 text-center text-sm text-pretty text-muted-foreground"
						>
							No emoji found for “{trimmed()}”
						</p>
					</Show>
				</div>
			</div>

			<Show when={platform() === "desktop"}>
				<div
					data-emoji-preview=""
					aria-hidden="true"
					class="-mx-2 -mb-2 flex h-12 shrink-0 items-center gap-3 border-t border-border px-3"
				>
					<Show when={preview()} keyed>
						{(item) => (
							<>
								<span class="flex size-8 items-center justify-center text-[28px] leading-none">
									<Show when={item.custom} fallback={item.char} keyed>
										{(custom) => <CustomGlyph emoji={custom} class="size-7" />}
									</Show>
								</span>
								<span class="flex min-w-0 flex-col">
									<span class="truncate text-sm font-semibold">
										:{item.shortcode}:
									</span>
									<Show when={item.pack}>
										{(pack) => (
											<span class="truncate text-xs text-muted-foreground">
												{pack().name}
											</span>
										)}
									</Show>
								</span>
							</>
						)}
					</Show>
				</div>
			</Show>
		</div>
	);
};
