import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { type JSX, Show } from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";

export type ConversationStartProps = {
	kind: "channel" | "thread";
	name: string;
	description?: string;
	icon?: JSX.Element;
	class?: string;
};

export const conversationStartTitle = (
	kind: "channel" | "thread",
	name: string,
) => (kind === "channel" ? `Welcome to #${name}` : name);

export const conversationStartText = (
	kind: "channel" | "thread",
	name: string,
) =>
	kind === "channel"
		? `This is the start of #${name}.`
		: "This is the start of this thread.";

export const ConversationStart = (props: ConversationStartProps) => (
	<section
		data-conversation-start={props.kind}
		aria-label={conversationStartText(props.kind, props.name)}
		class={cx(
			"flex flex-col items-start gap-2 px-(--chat-row-padding,16px) pt-6 pb-4",
			props.class,
		)}
	>
		<span
			aria-hidden="true"
			class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6"
		>
			<Show when={props.kind === "channel"} fallback={<ThreadIcon />}>
				{props.icon ?? <ChatSquareDotsIcon />}
			</Show>
		</span>
		<h2 class="min-w-0 max-w-full text-lg leading-6 font-semibold break-words">
			{conversationStartTitle(props.kind, props.name)}
		</h2>
		<p class="min-w-0 max-w-full text-sm leading-5 text-muted-foreground break-words">
			{conversationStartText(props.kind, props.name)}
			<Show when={props.description}>
				{(description) => (
					<>
						<br />
						{description()}
					</>
				)}
			</Show>
		</p>
	</section>
);

export type ThreadStartDividerProps = {
	label?: string;
	class?: string;
};

export const ThreadStartDivider = (props: ThreadStartDividerProps) => (
	<div
		data-thread-start=""
		class={cx(
			"flex h-5 items-center gap-2 px-(--chat-row-padding,16px) select-none",
			props.class,
		)}
	>
		<span aria-hidden="true" class="h-px flex-1 bg-border" />
		<span class="flex items-center gap-1 text-xs leading-4 font-semibold text-muted-foreground [&_svg]:size-3.5">
			<ThreadIcon />
			{props.label ?? "Start of thread"}
		</span>
		<span aria-hidden="true" class="h-px flex-1 bg-border" />
	</div>
);
