import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import type { IndexedMessageData } from "@/utils/sdk";

export type EmbedLoadCallback = () => void;

export type MessageContextData = {
	replyingTo: IndexedMessageData | undefined;
	focusedMessage: IndexedMessageData | undefined;
	editingMessageRkey: string | undefined;
};

export type MessageContextUtility = {
	setReplyingTo: (message: IndexedMessageData) => void;
	clearReplyingTo: () => void;
	jumpToMessage: (message: IndexedMessageData) => void;
	setEditingMessage: (rkey: string) => void;
	clearEditingMessage: () => void;
	registerEmbedLoadCallback: (cb: EmbedLoadCallback) => () => void;
	notifyEmbedLoad: () => void;
};

export const MessageContext =
	createContext<[MessageContextData, MessageContextUtility]>();

export const MessageContextProvider: ParentComponent = (props) => {
	const [messageContext, setMessageContext] = createStore<MessageContextData>({
		replyingTo: undefined,
		focusedMessage: undefined,
		editingMessageRkey: undefined,
	});

	const embedLoadCallbacks = new Set<EmbedLoadCallback>();

	const context: [MessageContextData, MessageContextUtility] = [
		messageContext,
		{
			setReplyingTo(message) {
				setMessageContext("replyingTo", undefined);
				setMessageContext("replyingTo", message);
			},
			clearReplyingTo() {
				setMessageContext("replyingTo", undefined);
			},
			jumpToMessage(message) {
				setMessageContext("focusedMessage", undefined);
				setMessageContext("focusedMessage", message);
				setTimeout(() => {
					setMessageContext("focusedMessage", undefined);
				}, 2000);
			},
			setEditingMessage(rkey) {
				setMessageContext("editingMessageRkey", rkey);
			},
			clearEditingMessage() {
				setMessageContext("editingMessageRkey", undefined);
			},
			registerEmbedLoadCallback(cb) {
				embedLoadCallbacks.add(cb);
				return () => embedLoadCallbacks.delete(cb);
			},
			notifyEmbedLoad() {
				for (const cb of embedLoadCallbacks) cb();
			},
		},
	];

	return (
		<MessageContext.Provider value={context}>
			{props.children}
		</MessageContext.Provider>
	);
};

export const useMessageContext = () => {
	const ctx = useContext(MessageContext);

	if (!ctx) throw new Error("Unable to get message context!");

	return ctx;
};
