import { type Component, createMemo, For, Show } from "solid-js";
import XIcon from "~icons/ph/x";
import type { Reaction } from "../../../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useMessageContext } from "../../../../../contexts/Message";
import { useUserContext } from "../../../../../contexts/User";
import { cx } from "../../../../../utils/cva";
import { parseEmojiText } from "../../../../../utils/emoji";
import User from "../../../user";
import { emojiShortcode, useReactorResolver } from "../reactors";

export const useActiveReaction = () => {
	const ctx = useMessageContext();

	return createMemo(
		() =>
			ctx
				.sortedReactions()
				.find((reaction) => reaction.emoji === ctx.reactionsViewerEmoji()) ??
			ctx.sortedReactions()[0],
	);
};

export const ReactionTab: Component<{
	reaction: Reaction;
	active: boolean;
	orientation: "vertical" | "horizontal";
	onSelect: () => void;
}> = (props) => {
	const shortcode = () => emojiShortcode(props.reaction.emoji);

	return (
		<button
			type="button"
			aria-label={
				shortcode()
					? `${props.reaction.count} reacted with :${shortcode()}:`
					: `${props.reaction.count} reacted`
			}
			aria-pressed={props.active}
			class={cx(
				"flex shrink-0 cursor-pointer flex-row items-center gap-1.5 transition-colors",
				props.orientation === "vertical"
					? "w-full rounded-sm px-2 py-1.5"
					: "rounded-t-sm border-b-2 px-3 py-2",
			)}
			classList={{
				"bg-primary/15 text-foreground":
					props.orientation === "vertical" && props.active,
				"text-muted-foreground hover:bg-muted":
					props.orientation === "vertical" && !props.active,
				"border-primary text-foreground":
					props.orientation === "horizontal" && props.active,
				"border-transparent text-muted-foreground":
					props.orientation === "horizontal" && !props.active,
			}}
			onClick={props.onSelect}
		>
			<span
				class="flex h-5 w-5 shrink-0 items-center justify-center"
				innerHTML={parseEmojiText(props.reaction.emoji)}
			/>
			<span class="text-sm tabular-nums">{props.reaction.count}</span>
		</button>
	);
};

export const ReactionTabs: Component<{
	orientation: "vertical" | "horizontal";
}> = (props) => {
	const ctx = useMessageContext();
	const active = useActiveReaction();

	return (
		<For each={ctx.sortedReactions()}>
			{(reaction) => (
				<ReactionTab
					reaction={reaction}
					orientation={props.orientation}
					active={active()?.emoji === reaction.emoji}
					onSelect={() => ctx.openReactionsViewer(reaction.emoji)}
				/>
			)}
		</For>
	);
};

const ReactorRow: Component<{ did: string; emoji: string }> = (props) => {
	const user = useUserContext();
	const { removeReaction } = useMessageContext();
	const resolveReactor = useReactorResolver();
	const actor = () => resolveReactor(props.did);
	const handle = () => actor().handle.replaceAll("at://", "");

	return (
		<div class="flex h-11 flex-row items-center gap-2 rounded-sm px-2">
			<User.Avatar user={actor()} size="small" />
			<span class="flex min-w-0 flex-1 flex-row items-center gap-2 overflow-hidden">
				<User.DisplayableName user={actor()} className="min-w-0" />
			</span>
			<Show when={handle() !== actor().data.displayName}>
				<span class="max-w-[45%] shrink-0 truncate text-sm text-muted-foreground">
					{handle()}
				</span>
			</Show>
			<Show when={props.did === user.did}>
				<button
					type="button"
					aria-label="Remove your reaction"
					class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
					onClick={() => void removeReaction(props.emoji)}
				>
					<XIcon />
				</button>
			</Show>
		</div>
	);
};

export const ReactorRows: Component<{ reaction: Reaction }> = (props) => {
	return (
		<div class="flex flex-col">
			<For each={props.reaction.reactorDIDs}>
				{(did) => <ReactorRow did={did} emoji={props.reaction.emoji} />}
			</For>
		</div>
	);
};
