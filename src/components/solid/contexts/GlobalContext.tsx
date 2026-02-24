import { APPVIEW_DOMAIN } from "astro:env/client";
import {
	makeHeartbeatWS,
	makeReconnectingWS,
} from "@solid-primitives/websocket";
import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { generateHash } from "@/utils/generate-hash";
import type {
	CategoryData,
	ChannelData,
	CommunityData,
	DBMessageData,
	IndexedMessageData,
} from "@/utils/sdk";

type ReactionEventCallback = (
	data: ReactionAddedEvent | ReactionRemovedEvent,
) => void;

export type GlobalContextData = {
	communities: Array<CommunityData>;
	categories: Array<CategoryData>;
	channels: Array<ChannelData>;
	pendingMessages: Array<PendingMessageData>;
	additionalMessages: Array<IndexedMessageData>;
	user: App.SessionData["user"];
	deletedMessages: Array<Omit<MessageDeletionEvent, "id">>;
};

export type GlobalContextUtility = {
	addChannel: (channel: ChannelData) => void;
	addCategory: (category: CategoryData) => void;
	addPendingMessage: (message: PendingMessageData) => void;
	removePendingMessage: (hash: string) => void;
	addDeletedMessage: (data: Omit<MessageDeletionEvent, "id">) => void;
	addAdditionalMessage: (message: IndexedMessageData) => void;
	clearAdditionalMessages: () => void;
	sendSocketMessage: (message: Record<string, any>) => void;
	clearDeletedMessages: () => void;
	addReactionListener: (callback: ReactionEventCallback) => () => void;
};

export type MessagePostEvent = {
	type: "message";
	id: string;
	created_at: string;
	indexed_at: string;
} & IndexedMessageData;

export type MessageDeletionEvent = {
	type: "message_deleted";
	id: string;
	rkey: string;
	author_did: string;
	channel: string;
};

export type ReactionData = {
	rkey: string;
	author_did: string;
	emoji: string;
	target_rkey: string;
	channel: string;
	target_author_did: string;
};

export type ReactionAddedEvent = ReactionData & {
	type: "reaction_added";
};

export type ReactionRemovedEvent = ReactionData & {
	type: "reaction_removed";
};

export type AckEvent = {
	type: "ack";
	message: string;
};

export type AppviewSubscriptionData =
	| MessagePostEvent
	| MessageDeletionEvent
	| AckEvent
	| ReactionAddedEvent
	| ReactionRemovedEvent;

export type PendingMessageData = Omit<DBMessageData, "rkey"> & {
	hash: string;
};

export const GlobalContext =
	createContext<[GlobalContextData, GlobalContextUtility]>();

const handleNewMessage = async (
	context: GlobalContextUtility,
	data: MessagePostEvent,
) => {
	const string = JSON.stringify({
		text: data.text,
		facets: data.facets,
		channel: data.channel,
		createdAt: data.created_at,
	});
	const hash = await generateHash(string);

	context.removePendingMessage(hash);

	context.addAdditionalMessage(data);
};

const handleMessageDeletion = async (
	context: GlobalContextUtility,
	data: MessageDeletionEvent,
) => {
	context.addDeletedMessage(data);
};

export const GlobalContextProvider: ParentComponent<{
	contextData: {
		communities: Array<CommunityData>;
		user: App.SessionData["user"];
	};
}> = (props) => {
	const reactionListeners = new Set<ReactionEventCallback>();

	const socket = makeHeartbeatWS(
		makeReconnectingWS(`wss://${APPVIEW_DOMAIN}/api/subscribe`),
		{
			message: JSON.stringify({ action: "heartbeat", event_type: "heartbeat" }),
			interval: 20_000,
		},
	);

	const [globalContext, setGlobalContext] = createStore<GlobalContextData>({
		...props.contextData,
		additionalMessages: [],
		categories: [],
		channels: [],
		pendingMessages: [],
		deletedMessages: [],
	});

	const context: [GlobalContextData, GlobalContextUtility] = [
		globalContext,
		{
			addChannel(channel) {
				setGlobalContext("channels", (list) => [...list, channel]);
			},
			addCategory(category) {
				setGlobalContext("categories", (list) => [...list, category]);
			},
			addPendingMessage(message) {
				setGlobalContext("pendingMessages", (list) => [...list, message]);
			},
			removePendingMessage(hash) {
				setGlobalContext("pendingMessages", (list) =>
					list.filter((m) => m.hash !== hash),
				);
			},
			addAdditionalMessage(message) {
				setGlobalContext("additionalMessages", (list) => [...list, message]);
			},
			clearAdditionalMessages() {
				setGlobalContext("additionalMessages", []);
			},
			sendSocketMessage(message) {
				socket.send(JSON.stringify(message));
			},
			addDeletedMessage(data) {
				setGlobalContext("deletedMessages", (list) => {
					if (
						list.find(
							(x) =>
								x.rkey === data.rkey &&
								x.channel === data.channel &&
								x.author_did === data.author_did,
						)
					) {
						return list;
					}

					return [...list, data];
				});
			},
			clearDeletedMessages() {
				setGlobalContext("deletedMessages", []);
			},
			addReactionListener(callback) {
				reactionListeners.add(callback);
				return () => reactionListeners.delete(callback);
			},
		},
	];

	socket.addEventListener("message", async (message) => {
		const data = JSON.parse(message.data) as AppviewSubscriptionData;

		switch (data.type) {
			case "message":
				handleNewMessage(context[1], data);
				break;
			case "message_deleted":
				handleMessageDeletion(context[1], data);
				break;
			case "reaction_added":
			case "reaction_removed":
				reactionListeners.forEach((callback) => {
					callback(data);
				});
				break;
			case "ack":
				break;
			default:
				console.error("Unknown event: ", data);
		}
		if (data.type !== "message") return;
	});

	return (
		<GlobalContext.Provider value={context}>
			{props.children}
		</GlobalContext.Provider>
	);
};

export const useGlobalContext = () => {
	const ctx = useContext(GlobalContext);

	if (!ctx) throw new Error("Unable to get global context!");

	return ctx;
};
