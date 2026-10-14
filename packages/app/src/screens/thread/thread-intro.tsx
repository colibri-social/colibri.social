import {
	ConversationStart,
	type MessageListEntry,
	ThreadStartDivider,
} from "@colibri-social/ui";
import { createMemo, Show } from "solid-js";
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
			void data.channel(props.thread.channel).react(message.rkey, emoji, add);
	});
	const anchorView = createMemo<MessageView | undefined>(() => {
		const stored = props.thread.anchorMessage as MessageParent | undefined;
		if (!isVisibleParent(stored)) return undefined;
		const live = data
			.channel(props.thread.channel)
			.messages()
			.find((message) => message.rkey === stored.rkey);
		return live ?? stored;
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
