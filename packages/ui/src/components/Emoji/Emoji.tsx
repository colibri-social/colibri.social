import { createMemo, createSignal, For, Match, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import {
	emojiImageSrc,
	isJumboEmojiText,
	splitEmojiSegments,
} from "../../utils/emoji";

export type EmojiSize = "inline" | "jumbo";

const sizeClass: Record<EmojiSize, string> = {
	inline: "size-[1.35em] mx-[0.05em]",
	jumbo: "size-[2.5em] my-1.5",
};

const nativeSizeClass: Record<EmojiSize, string> = {
	inline: "text-[1.1em]",
	jumbo: "text-[2.1em]",
};

const frameClass =
	"inline-flex shrink-0 items-center justify-center align-middle leading-none select-none";

export type EmojiProps = {
	emoji?: string;
	src?: string;
	name?: string;
	size?: EmojiSize;
	class?: string;
};

export const Emoji = (props: EmojiProps) => {
	const [failed, setFailed] = createSignal<string | undefined>();
	const size = () => props.size ?? "inline";
	const label = () =>
		props.src ? `:${props.name ?? "emoji"}:` : (props.emoji ?? "");
	const imageSrc = createMemo(() =>
		props.src
			? props.src
			: props.emoji
				? emojiImageSrc(props.emoji)
				: undefined,
	);
	const showImage = () => {
		const src = imageSrc();
		return !!src && failed() !== src;
	};

	return (
		<Switch>
			<Match when={showImage()}>
				<img
					data-emoji={props.src ? "custom" : "unicode"}
					src={imageSrc()}
					alt={label()}
					title={props.src ? label() : undefined}
					draggable={false}
					loading="lazy"
					decoding="async"
					onError={() => setFailed(imageSrc())}
					class={cx(
						frameClass,
						sizeClass[size()],
						"object-contain",
						props.class,
					)}
				/>
			</Match>
			<Match when={props.src && !props.emoji}>
				<span
					data-emoji="custom-fallback"
					class={cx(
						frameClass,
						"text-[0.85em] font-semibold text-muted-foreground",
						props.class,
					)}
				>
					{label()}
				</span>
			</Match>
			<Match when={true}>
				<span
					data-emoji="native"
					class={cx(
						frameClass,
						sizeClass[size()],
						nativeSizeClass[size()],
						"[font-variant-emoji:emoji]",
						props.class,
					)}
				>
					{props.emoji}
				</span>
			</Match>
		</Switch>
	);
};

export type EmojiTextProps = {
	text: string;
	jumbo?: boolean | "auto";
	class?: string;
};

export const EmojiText = (props: EmojiTextProps) => {
	const segments = createMemo(() => splitEmojiSegments(props.text));
	const size = (): "inline" | "jumbo" => {
		if (props.jumbo === "auto") {
			return isJumboEmojiText(props.text) ? "jumbo" : "inline";
		}
		return props.jumbo ? "jumbo" : "inline";
	};

	return (
		<span
			data-emoji-text=""
			data-jumbo={size() === "jumbo" || undefined}
			class={props.class}
		>
			<For each={segments()}>
				{(segment) =>
					segment.kind === "emoji" ? (
						<Emoji emoji={segment.value} size={size()} />
					) : (
						segment.value
					)
				}
			</For>
		</span>
	);
};
