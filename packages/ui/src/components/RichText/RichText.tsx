import { Popover as KobaltePopover } from "@kobalte/core/popover";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { isJumboEmojiText } from "../../utils/emoji";
import { EMOJI_DATA_RECORD } from "../../utils/emoji-data";
import { createLiveAnchor } from "../../utils/live-anchor";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { JUMBO_FONT_SCALE } from "../Emoji/Emoji";
import { PopoverContent } from "../Popover/Popover";
import {
	type RichTextPlatform,
	type TextWithFacets,
	useRichText,
} from "./context";
import {
	emojiFacetText,
	emojiShortcode,
	renderRichText,
	withCustomEmojiAsGlyphs,
} from "./render";

const TOGGLE_GRACE_MS = 400;

export type EmojiInfoTarget = {
	emoji: string;
	slug: string;
	element: HTMLElement;
};

const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/gu;

const metaFor = (emoji: string) => {
	const base = emoji.replace(SKIN_TONE, "");
	return (
		EMOJI_DATA_RECORD[base] ??
		EMOJI_DATA_RECORD[base.endsWith("️") ? base.slice(0, -1) : `${base}️`]
	);
};

const EmojiInfoBody = (props: { target: EmojiInfoTarget }) => {
	const shortcode = () => emojiShortcode(props.target.slug);
	const name = () => metaFor(props.target.emoji)?.name;
	return (
		<div data-emoji-info="" class="flex min-w-0 items-center gap-3">
			<span
				aria-hidden="true"
				class="flex size-10 shrink-0 items-center justify-center text-[32px] leading-none"
			>
				{props.target.emoji}
			</span>
			<span class="flex min-w-0 flex-col">
				<span class="text-sm leading-5 font-semibold break-all">
					:{shortcode()}:
				</span>
				<Show when={name()}>
					{(value) => (
						<span class="text-xs leading-4 text-muted-foreground first-letter:uppercase">
							{value()}
						</span>
					)}
				</Show>
			</span>
		</div>
	);
};

export const EmojiInfo = (props: {
	target: EmojiInfoTarget;
	platform: RichTextPlatform;
	onClose: () => void;
	onAnchorChange?: (element: HTMLElement | undefined) => void;
}) => {
	const overflowPadding = usePopperOverflowPadding(16);
	const live = createLiveAnchor({
		element: () => props.target.element,
		active: () => props.platform !== "mobile",
		onLost: () => props.onClose(),
	});
	createEffect(() => props.onAnchorChange?.(live.anchor()));
	return (
		<Show
			when={props.platform === "mobile"}
			fallback={
				<KobaltePopover
					open
					onOpenChange={(open) => !open && props.onClose()}
					anchorRef={live.anchor}
					getAnchorRect={live.rect}
					placement="top"
					gutter={8}
					overflowPadding={overflowPadding()}
				>
					<PopoverContent
						aria-label={`Emoji ${props.target.emoji}`}
						class="w-fit max-w-64 p-3"
					>
						<EmojiInfoBody target={props.target} />
					</PopoverContent>
				</KobaltePopover>
			}
		>
			<Drawer open onOpenChange={(open) => !open && props.onClose()}>
				<DrawerContent aria-label={`Emoji ${props.target.emoji}`}>
					<EmojiInfoBody target={props.target} />
				</DrawerContent>
			</Drawer>
		</Show>
	);
};

export type RichTextRendererProps = Omit<
	JSX.HTMLAttributes<HTMLDivElement>,
	"children"
> & {
	value: TextWithFacets;
	platform?: RichTextPlatform;
	jumbo?: boolean;
};

export const RichTextRenderer = (props: RichTextRendererProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"platform",
		"jumbo",
		"class",
		"onClick",
		"onKeyDown",
	]);
	const ctx = useRichText();
	const platform = () => local.platform ?? ctx.platform ?? "desktop";
	const rendered = createMemo(() => renderRichText(local.value, ctx));
	const jumbo = createMemo(() => {
		if (local.jumbo === false) return false;
		const text = emojiFacetText(local.value, ctx);
		return (
			text !== undefined &&
			isJumboEmojiText(withCustomEmojiAsGlyphs(text, ctx.customEmoji))
		);
	});

	const [emojiTarget, setEmojiTarget] = createSignal<EmojiInfoTarget>();
	let root: HTMLDivElement | undefined;
	let openedFrom: HTMLElement | undefined;
	let restoreFocus = false;
	let lastClosed: { element: HTMLElement; at: number } | undefined;

	const closeEmojiInfo = () => {
		const element = openedFrom;
		if (element) lastClosed = { element, at: performance.now() };
		setEmojiTarget(undefined);
		openedFrom = undefined;
		if (restoreFocus && element?.isConnected) element.focus();
		restoreFocus = false;
	};

	const emojiButtonFrom = (target: EventTarget | null) => {
		const element = (target as Element | null)?.closest?.<HTMLElement>(
			"[data-emoji-button]",
		);
		return element && root?.contains(element) ? element : undefined;
	};

	const openEmojiInfo = (element: HTMLElement, viaKeyboard: boolean) => {
		const emoji = element.dataset.emoji;
		const slug = element.dataset.slug;
		if (!emoji || !slug) return;
		if (openedFrom === element) {
			closeEmojiInfo();
			return;
		}
		const recentlyClosed =
			lastClosed?.element === element &&
			performance.now() - lastClosed.at < TOGGLE_GRACE_MS;
		lastClosed = undefined;
		if (recentlyClosed && !viaKeyboard) return;
		openedFrom = element;
		restoreFocus = viaKeyboard;
		setEmojiTarget({ emoji, slug, element });
	};

	const customEmojiFrom = (target: EventTarget | null) => {
		const element = (target as Element | null)?.closest?.<HTMLElement>(
			"[data-custom-emoji-button]",
		);
		return element && root?.contains(element) ? element : undefined;
	};

	const openCustomEmoji = (element: HTMLElement) => {
		const { customEmojiName, customEmojiSrc, customEmojiId, customEmojiAlt } =
			element.dataset;
		if (!customEmojiName || !customEmojiSrc) return;
		ctx.onCustomEmojiOpen?.(
			{
				name: customEmojiName,
				src: customEmojiSrc,
				id: customEmojiId,
				alt: customEmojiAlt,
			},
			element,
		);
	};

	const onClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event) => {
		if (typeof local.onClick === "function") local.onClick(event);
		if (event.defaultPrevented) return;
		const custom = customEmojiFrom(event.target);
		if (custom) {
			event.stopPropagation();
			openCustomEmoji(custom);
			return;
		}
		if (ctx.emojiInfo === false) return;
		const element = emojiButtonFrom(event.target);
		if (!element) return;
		event.stopPropagation();
		openEmojiInfo(element, event.detail === 0);
	};

	const onKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (
		event,
	) => {
		if (typeof local.onKeyDown === "function") local.onKeyDown(event);
		if (event.defaultPrevented) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		const custom = customEmojiFrom(event.target);
		if (custom) {
			event.preventDefault();
			event.stopPropagation();
			openCustomEmoji(custom);
			return;
		}
		if (ctx.emojiInfo === false) return;
		const element = emojiButtonFrom(event.target);
		if (!element) return;
		event.preventDefault();
		event.stopPropagation();
		openEmojiInfo(element, true);
	};

	return (
		<div
			{...rest}
			ref={root}
			data-rich-text=""
			data-jumbo={jumbo() || undefined}
			style={jumbo() ? { "font-size": `${JUMBO_FONT_SCALE}em` } : undefined}
			class={cx(
				"relative block w-full min-w-0 whitespace-pre-line select-text [overflow-wrap:anywhere] [&_a]:[-webkit-user-drag:none]",
				jumbo() && "leading-[1.3]",
				local.class,
			)}
			onClick={onClick}
			onKeyDown={onKeyDown}
		>
			{rendered()}
			<Show when={emojiTarget()} keyed>
				{(target) => (
					<EmojiInfo
						target={target}
						platform={platform()}
						onClose={closeEmojiInfo}
						onAnchorChange={(element) => {
							if (openedFrom && element?.matches("[data-emoji-button]"))
								openedFrom = element;
						}}
					/>
				)}
			</Show>
		</div>
	);
};
