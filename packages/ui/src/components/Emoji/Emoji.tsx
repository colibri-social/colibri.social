import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { EMOJI_GLYPH_EM, isJumboEmojiText } from "../../utils/emoji";
import {
	AnimatedImage,
	type AnimatedImagePlayback,
} from "../AnimatedImage/AnimatedImage";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

export type EmojiSize = "inline" | "jumbo" | number;

export const JUMBO_FONT_SCALE = 2;

const frameClass =
	"inline-flex shrink-0 items-center justify-center align-middle leading-none select-none";

const sizeStyle = (size: EmojiSize): JSX.CSSProperties | undefined => {
	if (typeof size === "number") {
		return {
			"font-size": `${size / EMOJI_GLYPH_EM}px`,
			width: `${size}px`,
			height: `${size}px`,
		};
	}
	if (size === "jumbo") return { "font-size": `${JUMBO_FONT_SCALE}em` };
	return undefined;
};

const imageSizeStyle = (size: EmojiSize): JSX.CSSProperties => {
	if (typeof size === "number") {
		return { width: `${size}px`, height: `${size}px` };
	}
	const em = EMOJI_GLYPH_EM * (size === "jumbo" ? JUMBO_FONT_SCALE : 1);
	return { width: `${em}em`, height: `${em}em` };
};

export type EmojiProps = {
	emoji?: string;
	src?: string;
	name?: string;
	size?: EmojiSize;
	playback?: AnimatedImagePlayback;
	tooltip?: boolean;
	class?: string;
};

export const Emoji = (props: EmojiProps) => {
	const [failedSrc, setFailedSrc] = createSignal<string>();
	const size = () => props.size ?? "inline";
	const shortcode = () => `:${props.name ?? "emoji"}:`;
	const showImage = () => !!props.src && failedSrc() !== props.src;

	return (
		<Show
			when={showImage()}
			fallback={
				<span
					data-emoji={props.src ? "custom-fallback" : "unicode"}
					style={props.src ? undefined : sizeStyle(size())}
					class={cx(
						frameClass,
						props.src && "text-[0.85em] font-semibold text-muted-foreground",
						props.class,
					)}
				>
					{props.src ? shortcode() : props.emoji}
				</span>
			}
		>
			<Tooltip disabled={props.tooltip === false}>
				<TooltipTrigger
					as="span"
					data-emoji-tooltip=""
					class="inline-flex shrink-0 align-middle leading-none"
				>
					<AnimatedImage
						data-emoji="custom"
						src={props.src}
						alt={shortcode()}
						playback={props.playback}
						draggable={false}
						loading="lazy"
						decoding="async"
						onError={() => setFailedSrc(props.src)}
						style={imageSizeStyle(size())}
						class={cx(frameClass, "object-contain", props.class)}
					/>
				</TooltipTrigger>
				<TooltipContent>{shortcode()}</TooltipContent>
			</Tooltip>
		</Show>
	);
};

export type CustomEmojiImageProps = {
	src?: string;
	name: string;
	size: number;
	unavailable?: boolean;
	playback?: AnimatedImagePlayback;
	onError?: (src: string) => Promise<boolean> | undefined;
	class?: string;
};

type CustomEmojiImageState = "loading" | "loaded" | "unavailable";

export const CustomEmojiImage = (props: CustomEmojiImageProps) => {
	const [loadedSrc, setLoadedSrc] = createSignal<string>();
	const [failedSrc, setFailedSrc] = createSignal<string>();
	const [pendingSrc, setPendingSrc] = createSignal<string>();
	const usable = () => !!props.src && failedSrc() !== props.src;
	const state = (): CustomEmojiImageState => {
		if (usable()) return loadedSrc() === props.src ? "loaded" : "loading";
		if (props.src && pendingSrc() === props.src) return "loading";
		return props.src || props.unavailable ? "unavailable" : "loading";
	};
	const retried = new Set<string>();
	const fail = async (src: string) => {
		setFailedSrc(src);
		if (retried.has(src) || !props.onError) return;
		retried.add(src);
		setPendingSrc(src);
		const recovered = await props.onError(src);
		if (pendingSrc() === src) setPendingSrc(undefined);
		if (recovered && failedSrc() === src) setFailedSrc(undefined);
	};

	return (
		<span
			role="img"
			aria-label={`:${props.name}:`}
			data-custom-emoji-image={props.name}
			data-custom-emoji-pending={state() === "loading" ? "" : undefined}
			data-custom-emoji-unavailable={state() === "unavailable" ? "" : undefined}
			data-skeleton={state() === "loading" ? "" : undefined}
			class={cx(
				"shrink-0 overflow-hidden rounded-[4px]",
				state() === "unavailable" && "bg-[var(--skeleton-base)]",
				props.class,
			)}
			style={{
				display: "inline-block",
				width: `${props.size}px`,
				height: `${props.size}px`,
			}}
		>
			<Show when={usable() && props.src} keyed>
				{(src) => (
					<AnimatedImage
						src={src}
						alt=""
						playback={props.playback}
						draggable={false}
						decoding="async"
						onLoad={() => setLoadedSrc(src)}
						onError={() => void fail(src)}
						class={cx(
							"block size-full object-contain",
							loadedSrc() !== src && "opacity-0",
						)}
					/>
				)}
			</Show>
		</span>
	);
};

export type EmojiTextProps = {
	text: string;
	jumbo?: boolean | "auto";
	class?: string;
};

export const EmojiText = (props: EmojiTextProps) => {
	const jumbo = () =>
		props.jumbo === "auto" ? isJumboEmojiText(props.text) : !!props.jumbo;

	return (
		<span
			data-emoji-text=""
			data-jumbo={jumbo() || undefined}
			style={jumbo() ? { "font-size": `${JUMBO_FONT_SCALE}em` } : undefined}
			class={cx(jumbo() && "leading-[1.3]", props.class)}
		>
			{props.text}
		</span>
	);
};
