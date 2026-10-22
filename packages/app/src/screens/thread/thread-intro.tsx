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
import {
	createMediaLinkRefresher,
	MediaLinkContext,
} from "../../data/media-link";
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
import { createAnchorLinkRefresher } from "./anchor-links";

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
	const [refreshed, setRefreshed] = createSignal<StoredAnchor>();
	createEffect(
		on(anchorKey, (key) => {
			setFetched(undefined);
			setRefreshed(undefined);
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
		const stored = (refreshed() ?? props.thread.anchorMessage ?? fetched()) as
			| MessageParent
			| undefined;
		return isVisibleParent(stored) ? stored : undefined;
	});
	const liveFeed = () => {
		const anchor = props.thread.anchor;
		if (!anchor) return undefined;
		const feed = data.channel(anchor.space);
		const held = untrack(feed.messages).some(
			(message) =>
				message.rkey === anchor.rkey && message.author.did === anchor.did,
		);
		return held ? feed : undefined;
	};
	const liveLinks = createMediaLinkRefresher({
		feed: liveFeed,
		listMessages: (params) => data.source.listMessages(params),
	});
	const links = createAnchorLinkRefresher({
		live: () => (liveFeed() ? liveLinks : undefined),
		reload: async () => {
			const full = await data.source.getThread(props.thread.space);
			if (full.anchorMessage) setRefreshed(() => full.anchorMessage);
		},
		current: () => untrack(anchorView),
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
			seamEnd: false,
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
					<MediaLinkContext.Provider value={links}>
						<ChatContextProvider value={chat}>
							<MessageItem entry={current} />
						</ChatContextProvider>
					</MediaLinkContext.Provider>
					<ThreadStartDivider class="mt-2" />
				</div>
			)}
		</Show>
	);
};
