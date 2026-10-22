import {
	batch,
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { EMOJI_GLYPH_EM, isJumboEmojiText } from "../../utils/emoji";
import { isStaticSource } from "../../utils/playback";
import {
	AnimatedImage,
	type AnimatedImagePlayback,
} from "../AnimatedImage/AnimatedImage";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

export type EmojiSize = "inline" | "jumbo" | number;

export const EMOJI_IMAGE_RETRY_DELAYS_MS = [1_000, 4_000, 15_000, 60_000];

const [imageWake, setImageWake] = createSignal(0);
let wakeInstalled = false;

const installImageWake = () => {
	if (wakeInstalled || typeof window === "undefined") return;
	wakeInstalled = true;
	const wake = () => setImageWake((count) => count + 1);
	window.addEventListener("online", wake);
	window.addEventListener("focus", wake);
};

export const emojiRetrySrc = (src: string, attempt: number) => {
	if (attempt === 0 || typeof location === "undefined") return src;
	try {
		const url = new URL(src, location.href);
		if (url.protocol !== "http:" && url.protocol !== "https:") return src;
		url.searchParams.set("retry", String(attempt));
		return url.toString();
	} catch {
		return src;
	}
};

export const createImageRetry = (src: () => string | undefined) => {
	installImageWake();
	const [attempt, setAttempt] = createSignal(0);
	const [failed, setFailed] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const stop = () => {
		clearTimeout(timer);
		timer = undefined;
	};
	const retry = () => {
		stop();
		if (!failed()) return;
		batch(() => {
			setFailed(false);
			setAttempt((count) => count + 1);
		});
	};
	createEffect(
		on(
			src,
			() => {
				stop();
				batch(() => {
					setFailed(false);
					setAttempt(0);
				});
			},
			{ defer: true },
		),
	);
	createEffect(on(imageWake, retry, { defer: true }));
	onCleanup(stop);
	return {
		failed,
		retry,
		src: () => {
			const current = src();
			return current && !failed()
				? emojiRetrySrc(current, attempt())
				: undefined;
		},
		fail: () => {
			stop();
			setFailed(true);
			const delay = EMOJI_IMAGE_RETRY_DELAYS_MS[attempt()];
			if (delay !== undefined) timer = setTimeout(retry, delay);
		},
	};
};

const demandAnimated = (
	playback: AnimatedImagePlayback | undefined,
	src: string | undefined,
) => (playback === "demand" ? !isStaticSource(src) : undefined);

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
	play?: boolean;
	tooltip?: boolean;
	class?: string;
};

export const Emoji = (props: EmojiProps) => {
	const image = createImageRetry(() => props.src);
	const size = () => props.size ?? "inline";
	const shortcode = () => `:${props.name ?? "emoji"}:`;
	const showImage = () => !!image.src();

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
						src={image.src()}
						alt={shortcode()}
						animated={demandAnimated(props.playback, props.src)}
						playback={props.playback}
						play={props.play}
						draggable={false}
						loading="lazy"
						decoding="async"
						onError={image.fail}
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
	const image = createImageRetry(() => props.src);
	const [loadedSrc, setLoadedSrc] = createSignal<string>();
	const [pendingSrc, setPendingSrc] = createSignal<string>();
	const state = (): CustomEmojiImageState => {
		const shown = image.src();
		if (shown) return loadedSrc() === shown ? "loaded" : "loading";
		if (props.src && pendingSrc() === props.src) return "loading";
		return props.src || props.unavailable ? "unavailable" : "loading";
	};
	const asked = new Set<string>();
	const fail = async () => {
		const src = props.src;
		image.fail();
		if (!src || asked.has(src) || !props.onError) return;
		asked.add(src);
		setPendingSrc(src);
		const recovered = await props.onError(src);
		if (pendingSrc() === src) setPendingSrc(undefined);
		if (recovered && props.src === src) image.retry();
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
			<Show when={image.src()} keyed>
				{(src) => (
					<AnimatedImage
						src={src}
						alt=""
						animated={demandAnimated(props.playback, props.src)}
						playback={props.playback}
						draggable={false}
						decoding="async"
						onLoad={() => setLoadedSrc(src)}
						onError={() => void fail()}
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
