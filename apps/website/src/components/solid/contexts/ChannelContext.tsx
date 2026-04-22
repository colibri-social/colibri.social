import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import type { IndexedMessageData } from "@/utils/sdk";

export type EmbedLoadCallback = () => void;
export type ScrollToBottomCallback = (force?: boolean) => void;

export type ChannelContextData = {
	replyingTo: IndexedMessageData | undefined;
	focusedMessage: IndexedMessageData | undefined;
	editingMessageRkey: string | undefined;
};

export type ChannelContextUtility = {
	setReplyingTo: (message: IndexedMessageData) => void;
	clearReplyingTo: () => void;
	jumpToMessage: (message: IndexedMessageData) => void;
	setEditingMessage: (rkey: string) => void;
	clearEditingMessage: () => void;
	registerEmbedLoadCallback: (cb: EmbedLoadCallback) => () => void;
	notifyEmbedLoad: () => void;
	registerScrollToBottomCallback: (cb: ScrollToBottomCallback) => () => void;
	triggerScrollToBottom: (force?: boolean) => void;
};

export const ChannelContext =
	createContext<[ChannelContextData, ChannelContextUtility]>();

export const ChannelContextProvider: ParentComponent = (props) => {
	const [channelContext, setChannelContext] = createStore<ChannelContextData>({
		replyingTo: undefined,
		focusedMessage: undefined,
		editingMessageRkey: undefined,
	});

	const embedLoadCallbacks = new Set<EmbedLoadCallback>();
	const scrollToBottomCallbacks = new Set<ScrollToBottomCallback>();

	const context: [ChannelContextData, ChannelContextUtility] = [
		channelContext,
		{
			setReplyingTo(message) {
				setChannelContext("replyingTo", undefined);
				setChannelContext("replyingTo", message);
			},
			clearReplyingTo() {
				setChannelContext("replyingTo", undefined);
			},
			jumpToMessage(message) {
				setChannelContext("focusedMessage", undefined);
				setChannelContext("focusedMessage", message);
				setTimeout(() => {
					setChannelContext("focusedMessage", undefined);
				}, 2000);
			},
			setEditingMessage(rkey) {
				setChannelContext("editingMessageRkey", rkey);
			},
			clearEditingMessage() {
				setChannelContext("editingMessageRkey", undefined);
			},
			registerEmbedLoadCallback(cb) {
				embedLoadCallbacks.add(cb);
				return () => embedLoadCallbacks.delete(cb);
			},
			notifyEmbedLoad() {
				for (const cb of embedLoadCallbacks) cb();
			},
			registerScrollToBottomCallback(cb) {
				scrollToBottomCallbacks.add(cb);
				return () => scrollToBottomCallbacks.delete(cb);
			},
			triggerScrollToBottom(force) {
				for (const cb of scrollToBottomCallbacks) cb(force);
			},
		},
	];

	return (
		<ChannelContext.Provider value={context}>
			{props.children}
		</ChannelContext.Provider>
	);
};

export const useChannelContext = () => {
	const ctx = useContext(ChannelContext);

	if (!ctx) throw new Error("Unable to get channel context!");

	return ctx;
};
