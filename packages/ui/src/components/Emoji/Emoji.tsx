import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { EMOJI_GLYPH_EM, isJumboEmojiText } from "../../utils/emoji";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";

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
			<AnimatedImage
				data-emoji="custom"
				src={props.src}
				alt={shortcode()}
				title={shortcode()}
				draggable={false}
				loading="lazy"
				decoding="async"
				onError={() => setFailedSrc(props.src)}
				style={imageSizeStyle(size())}
				class={cx(frameClass, "object-contain", props.class)}
			/>
		</Show>
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
