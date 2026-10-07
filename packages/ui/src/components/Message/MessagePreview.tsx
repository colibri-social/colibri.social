import { ReplyIcon } from "@solar-icons/solid/linear/reply";
import { type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import {
	formatFullTimestamp,
	formatMessageTime,
	type TimeInput,
} from "../../utils/time";

export type MessagePreviewProps = {
	author: string;
	badge?: JSX.Element;
	timestamp: TimeInput;
	now?: TimeInput;
	locale?: string;
	reply?: JSX.Element;
	children?: JSX.Element;
	onClick?: (event: MouseEvent) => void;
	href?: string;
	class?: string;
};

export const MessagePreview = (props: MessagePreviewProps) => {
	const [local] = splitProps(props, [
		"author",
		"badge",
		"timestamp",
		"now",
		"locale",
		"reply",
		"children",
		"onClick",
		"href",
		"class",
	]);
	const badge = createSlot(() => local.badge);
	const reply = createSlot(() => local.reply);
	const interactive = () => !!(local.onClick || local.href);
	const ripple = createRipple();

	return (
		<Dynamic
			ref={(element: HTMLElement) => {
				if (interactive()) ripple(element);
			}}
			component={local.href ? "a" : interactive() ? "button" : "div"}
			type={!local.href && interactive() ? "button" : undefined}
			href={local.href}
			onClick={local.onClick}
			data-message-preview=""
			class={cx(
				"flex w-full flex-col gap-2 p-3 text-left text-foreground",
				interactive() &&
					"ripple cursor-pointer outline-none hover:bg-popover focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]",
				local.class,
			)}
		>
			<Show when={reply.has()}>
				<span
					data-message-preview-reply=""
					class="flex h-4 w-full min-w-0 items-center gap-1 text-xs leading-4 text-foreground"
				>
					<ReplyIcon aria-hidden="true" class="size-4 shrink-0" />
					<span class="min-w-0 flex-1 truncate">{reply()}</span>
				</span>
			</Show>
			<span class="flex w-full min-w-0 flex-col gap-1">
				<span class="flex h-4 min-w-0 items-center gap-3">
					<span class="flex min-w-0 items-center gap-1.5">
						<span class="truncate text-sm leading-4 font-semibold">
							{local.author}
						</span>
						<Show when={badge.has()}>{badge()}</Show>
					</span>
					<time
						class="shrink-0 text-xs leading-4 whitespace-nowrap text-muted-foreground"
						title={formatFullTimestamp(local.timestamp, local.locale)}
					>
						{formatMessageTime(local.timestamp, local.now, local.locale)}
					</time>
				</span>
				<span
					data-message-preview-content=""
					class="line-clamp-3 text-base leading-[21px] [overflow-wrap:anywhere]"
				>
					{local.children}
				</span>
			</span>
		</Dynamic>
	);
};
