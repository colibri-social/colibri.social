import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	ConversationStart,
	type MessageListEntry,
	ThreadStartDivider,
} from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { useData } from "../../data/store";
import type { MessageView, ThreadView } from "../../data/types";
import {
	ChatContextProvider,
	type ChatContextValue,
	useChat,
} from "../channel/message/chat-context";
import { MessageItem } from "../channel/message/MessageItem";
import {
	type ChatMessage,
	isVisibleParent,
	type MessageParent,
	toChatMessage,
} from "../channel/message/types";

export const ANCHOR_KEY_PREFIX = "anchor:";

const log = createLogger("thread-intro");

type StoredAnchor = ThreadView["anchorMessage"];

const anchorChat = (
	chat: ChatContextValue,
	react: ChatContextValue["onReact"],
): ChatContextValue =>
	Object.create(chat, {
		onReact: { value: react },
		onJumpTo: { value: () => {} },
		onStartThread: { value: undefined },
		selection: { value: undefined },
	});

export const ThreadIntro = (props: { thread: ThreadView }) => {
	const data = useData();
	const chat = anchorChat(useChat(), (message, emoji, add) => {
		if (message.rkey)
			void data
				.channel(props.thread.anchor?.space ?? props.thread.channel)
				.react(message.rkey, emoji, add);
	});
	const anchorKey = createMemo(() => {
		const anchor = props.thread.anchor;
		return anchor
			? `${props.thread.space} ${anchor.space} ${anchor.did} ${anchor.rkey}`
			: undefined;
	});
	const [fetched, setFetched] = createSignal<StoredAnchor>();
	createEffect(
		on(anchorKey, (key) => {
			setFetched(undefined);
			if (!key) return;
			let current = true;
			onCleanup(() => {
				current = false;
			});
			data.threads.anchorMessage(untrack(() => props.thread)).then(
				(message) => {
					if (current) setFetched(() => message);
				},
				(thrown: unknown) => {
					log.warn("anchor message failed to load", {
						code: classifyThrown(thrown, { method: "thread.getThread" }).code,
					});
				},
			);
		}),
	);
	const anchorView = createMemo<MessageView | undefined>(() => {
		const anchor = props.thread.anchor;
		const live = anchor
			? data
					.channel(anchor.space)
					.messages()
					.find(
						(message) =>
							message.rkey === anchor.rkey && message.author.did === anchor.did,
					)
			: undefined;
		if (live) return live;
		const stored = (props.thread.anchorMessage ?? fetched()) as
			| MessageParent
			| undefined;
		return isVisibleParent(stored) ? stored : undefined;
	});
	const entry = createMemo<MessageListEntry<ChatMessage> | undefined>(() => {
		const view = anchorView();
		if (!view) return undefined;
		const message: ChatMessage = {
			...toChatMessage(view, { key: `${ANCHOR_KEY_PREFIX}${view.rkey}` }),
			anchor: true,
		};
		return {
			message,
			key: message.key,
			position: 0,
			unreadStart: false,
			continuation: false,
			hasContinuation: false,
			newDay: false,
			last: true,
		};
	});
	return (
		<Show
			when={entry()}
			fallback={<ConversationStart kind="thread" name={props.thread.name} />}
		>
			{(current) => (
				<div data-thread-anchor="" class="flex flex-col pt-2 pb-1">
					<ChatContextProvider value={chat}>
						<MessageItem entry={current} />
					</ChatContextProvider>
					<ThreadStartDivider class="mt-2" />
				</div>
			)}
		</Show>
	);
};
