import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Emoji } from "../Emoji/Emoji";
import type { CustomEmoji } from "../EmojiPicker/EmojiPicker";

export type StatusEmojiProps = {
	emoji?: string;
	customEmoji?: CustomEmoji;
	size?: number | "inline";
	tooltip?: boolean;
	class?: string;
};

export const StatusEmoji = (props: StatusEmojiProps) => (
	<Show
		when={props.customEmoji}
		fallback={
			<Show when={props.emoji}>
				{(emoji) => (
					<Emoji emoji={emoji()} size={props.size} class={props.class} />
				)}
			</Show>
		}
	>
		{(custom) => (
			<Emoji
				src={custom().src}
				name={custom().name}
				size={props.size}
				playback="demand"
				tooltip={props.tooltip}
				class={props.class}
			/>
		)}
	</Show>
);

export type StatusTextProps = {
	text?: string;
	emoji?: string;
	customEmoji?: CustomEmoji;
	class?: string;
};

export const StatusText = (props: StatusTextProps) => (
	<span
		data-status-line=""
		class={cx("flex min-w-0 items-center gap-1", props.class)}
	>
		<StatusEmoji emoji={props.emoji} customEmoji={props.customEmoji} />
		<Show when={props.text}>
			<span class="min-w-0 truncate">{props.text}</span>
		</Show>
	</span>
);

export const hasStatusContent = (status: StatusTextProps | undefined) =>
	!!status && (!!status.text || !!status.emoji || !!status.customEmoji);
