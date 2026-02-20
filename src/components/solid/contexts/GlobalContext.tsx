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
	IndexedMessageData,
	MessageData,
} from "@/utils/sdk";

export type GlobalContextData = {
	communities: Array<CommunityData>;
	categories: Array<CategoryData>;
	channels: Array<ChannelData>;
	pendingMessages: Array<PendingMessageData>;
	additionalMessages: Array<IndexedMessageData>;
	user: App.SessionData["user"];
};

export type GlobalContextUtility = {
	addChannel: (channel: ChannelData) => void;
	addCategory: (category: CategoryData) => void;
	addPendingMessage: (message: PendingMessageData) => void;
	removePendingMessage: (hash: string) => void;
	addAdditionalMessage: (message: IndexedMessageData) => void;
	clearAdditionalMessages: () => void;
	sendSocketMessage: (message: Record<string, any>) => void;
};

export type AppviewSubscriptionData = {
	type: "message";
	id: string;
	rkey: string;
	author_did: string;
	text: string;
	channel: string;
	created_at: string;
	indexed_at: string;
	display_name: string;
	avatar_url: string;
};

export type PendingMessageData = Omit<MessageData, "rkey"> & {
	hash: string;
};

export const GlobalContext =
	createContext<[GlobalContextData, GlobalContextUtility]>();

export const GlobalContextProvider: ParentComponent<{
	contextData: {
		communities: Array<CommunityData>;
		user: App.SessionData["user"];
	};
}> = (props) => {
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
		},
	];

	socket.addEventListener("message", async (message) => {
		const data = JSON.parse(message.data) as AppviewSubscriptionData;

		if (data.type !== "message") return;

		const hash = await generateHash(
			JSON.stringify({
				text: data.text,
				channel: data.channel,
				createdAt: data.created_at,
			}),
		);

		context[1].removePendingMessage(hash);

		context[1].addAdditionalMessage({
			channel: data.channel,
			created_at: data.created_at,
			rkey: data.rkey,
			text: data.text,
			author_did: data.author_did,
			display_name: data.display_name!,
			avatar_url: data.avatar_url!,
		});
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
