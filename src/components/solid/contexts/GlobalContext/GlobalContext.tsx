import { APPVIEW_DOMAIN } from "astro:env/client";
import {
	makeHeartbeatWS,
	makeReconnectingWS,
} from "@solid-primitives/websocket";
import { type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import type { ChannelData, CommunityData } from "@/utils/sdk";
import type { AppviewSubscriptionData, ReactionEventCallback } from "./events";
import { handleMessageDeletion, handleNewMessage } from "./handlers";
import type { GlobalContextData, GlobalContextUtility } from "./types";
import { GlobalContext } from "./context";

export { GlobalContext };

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
			message: JSON.stringify({
				action: "heartbeat",
				event_type: "heartbeat",
			}),
			interval: 20_000,
		},
	);

	const [globalContext, setGlobalContext] = createStore<GlobalContextData>({
		...props.contextData,
		additionalMessages: [],
		categories: [],
		addedChannels: [],
		removedChannels: [],
		pendingMessages: [],
		deletedMessages: [],
	});

	const context: [GlobalContextData, GlobalContextUtility] = [
		globalContext,
		{
			addCommunity(community) {
				setGlobalContext("communities", (list) => {
					const alreadyExistsIndex = list.findIndex(
						(c) => c.rkey === community.rkey,
					);

					if (alreadyExistsIndex >= 0) {
						return list.toSpliced(alreadyExistsIndex, 1, community);
					}

					return [community, ...list];
				});
			},
			removeCommunity(rkey) {
				setGlobalContext("communities", (list) =>
					list.filter((x) => x.rkey !== rkey),
				);
			},
			addCategory(category) {
				setGlobalContext("categories", (list) => {
					const alreadyExistsIndex = list.findIndex(
						(c) => c.rkey === category.rkey,
					);

					if (alreadyExistsIndex >= 0) {
						return list.toSpliced(alreadyExistsIndex, 1, category);
					}

					return [category, ...list];
				});
			},
			removeCategory(rkey) {
				setGlobalContext("categories", (list) =>
					list.filter((x) => x.rkey !== rkey),
				);
			},
			addChannel(channel) {
				setGlobalContext("addedChannels", (list) => {
					const alreadyExistsIndex = list.findIndex(
						(c) => c.rkey === channel.rkey,
					);

					if (alreadyExistsIndex >= 0) {
						return list.toSpliced(alreadyExistsIndex, 1, channel);
					}

					return [...list, channel];
				});
			},
			removeChannel(channel) {
				setGlobalContext("removedChannels", (list) => {
					const alreadyExistsIndex = list.findIndex(
						(c) => c.rkey === channel.rkey,
					);

					if (alreadyExistsIndex >= 0) {
						return list.toSpliced(alreadyExistsIndex, 1, channel);
					}

					return [...list, channel];
				});
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
				const existingIndex = globalContext.additionalMessages.findIndex(
					(x) => x.rkey === message.rkey,
				);
				if (existingIndex !== -1) {
					const newArray = globalContext.additionalMessages.toSpliced(
						existingIndex,
						1,
						message,
					);
					setGlobalContext("additionalMessages", newArray);
				} else {
					setGlobalContext("additionalMessages", (list) => [...list, message]);
				}
			},
			clearAdditionalMessages() {
				setGlobalContext("additionalMessages", []);
			},
			sendSocketMessage(message) {
				socket.send(JSON.stringify(message));
			},
			addDeletedMessage(data) {
				setGlobalContext("deletedMessages", (list) => {
					const alreadyExists = list.find(
						(x) =>
							x.rkey === data.rkey &&
							x.channel === data.channel &&
							x.author_did === data.author_did,
					);
					if (alreadyExists) return list;
					return [...list, data];
				});
			},
			clearDeletedMessages() {
				setGlobalContext("deletedMessages", []);
			},
			addReactionListener(callback) {
				reactionListeners.add(callback);
				return () => {
					reactionListeners.delete(callback);
				};
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
			case "community_upserted":
				// TODO: handle community upsert
				break;
			case "community_deleted":
				// TODO: handle community deletion
				break;
			case "channel_created":
				context[1].addChannel({
					rkey: data.rkey,
					name: data.name,
					type: data.channel_type as ChannelData["type"],
					category: data.category_rkey,
					community: data.community_uri.split("/").pop()!,
				});
				break;
			case "channel_deleted":
				// TODO: handle channel deletion
				break;
			case "category_created":
				context[1].addCategory({
					rkey: data.rkey,
					name: data.name,
					channelOrder: [],
					community: data.community_uri.split("/").pop()!,
				});
				break;
			case "category_deleted":
				// TODO: handle category deletion
				break;
			case "member_pending":
				// TODO: handle pending member
				break;
			case "member_joined":
				// TODO: handle member joined
				break;
			case "member_left":
				// TODO: handle member left
				break;
			case "ack":
				break;
			default:
				console.error("Unknown event: ", data);
		}
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
