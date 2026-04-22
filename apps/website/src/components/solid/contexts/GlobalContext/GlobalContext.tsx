import { actions } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { serverPort } from "virtual:server-port";
import {
	createReconnectingWS,
	makeHeartbeatWS,
	makeReconnectingWS,
} from "@solid-primitives/websocket";
import { createEffect, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { getClient } from "@/utils/atproto/auth";
import type { ChannelData } from "@/utils/sdk";
import { usePreferencesContext } from "../UserPreferencesContext";
import { GlobalContext } from "./context";
import type { AppviewSubscriptionData, ReactionEventCallback } from "./events";
import {
	handleMessageDeletion,
	handleNewMessage,
	handleUserProfileUpdated,
	handleUserStatusChanged,
} from "./handlers";
import type { GlobalContextData, GlobalContextUtility } from "./types";

export { GlobalContext };

export const GlobalContextProvider: ParentComponent = (props) => {
	const community = () => window.location.href.split("/")[5];
	const reactionListeners = new Set<ReactionEventCallback>();
	const [userPreferences, setUserPreferences] = usePreferencesContext();

	let socket: (WebSocket & { reconnect: () => void }) | undefined;

	const init = async () => {
		const res = await getClient();

		if (!res?.loggedIn) return;

		const { data } = await res.agent.com.atproto.server.getServiceAuth({
			aud: "did:web:api.colibri.social",
			lxm: "social.colibri.sync.subscribeEvents",
			exp: Math.floor(Date.now() / 1000) + 60,
		});

		const hostWithProtocol = import.meta.env.DEV
			? `ws://127.0.0.1:8000`
			: `wss://${res.pdsHost}`;

		socket = makeHeartbeatWS(
			createReconnectingWS(
				`${hostWithProtocol}/xrpc/social.colibri.sync.subscribeEvents?auth=${data.token}`,
			),
			{
				message: JSON.stringify({
					type: "heartbeat",
				}),
				interval: 20_000,
			},
		);

		socket.addEventListener("message", async (message) => {
			console.log(message);
		});
	};

	init();

	const [globalContext, setGlobalContext] = createStore<GlobalContextData>({
		additionalMessages: [],
		categories: [],
		addedChannels: [],
		removedChannels: [],
		removedCategories: [],
		pendingMessages: [],
		deletedMessages: [],
		joinedMembers: [],
		removedMembers: [],
		uiStates: {
			membersListVisible: userPreferences.membersListVisible,
		},
		memberProfileOverrides: [],
		memberStatusOverrides: [],
		// TODO(app): This might not reflect the user's preferred state.
		userOnlineStates: [
			{ did: "did:plc:w64dlsa4zwjv2wljlvmymldc", state: "online" },
		],
		knownVoiceChannelStates: [],
		communities: [],
		user: {
			avatar: undefined,
			banner: undefined,
			description: undefined,
			displayName: undefined,
			communities: [],
			identity: "did:plc:w64dlsa4zwjv2wljlvmymldc",
			sub: "did:plc:w64dlsa4zwjv2wljlvmymldc",
		},
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

					return [...list, community];
				});
			},
			removeCommunity(rkey) {
				setGlobalContext("communities", (list) =>
					list.filter((x) => x.rkey !== rkey),
				);

				actions.removeFromCommunityOrder({ community: rkey });
			},
			setCommunities(communities) {
				const rkeys = communities.map((x) => x.rkey);

				actions.setCommunityOrder({
					communities: rkeys,
				});

				setGlobalContext((state) => ({
					...state,
					user: {
						...state.user,
						communities: rkeys,
					},
					communities,
				}));
			},
			addCategory(category) {
				setGlobalContext("categories", (list) => {
					const alreadyExistsIndex = list.findIndex(
						(c) => c.rkey === category.rkey,
					);

					if (alreadyExistsIndex >= 0) {
						return list.toSpliced(alreadyExistsIndex, 1, category);
					}

					return [...list, category];
				});
			},
			removeCategory(rkey) {
				setGlobalContext("categories", (list) =>
					list.filter((x) => x.rkey !== rkey),
				);
				setGlobalContext("removedCategories", (list) => {
					if (list.includes(rkey)) return list;
					return [...list, rkey];
				});
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
			removeChannel(rkey) {
				setGlobalContext("removedChannels", (list) => {
					const alreadyExists = list.find((x) => x === rkey);
					if (alreadyExists) return list;
					return [...list, rkey];
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
				socket?.send(JSON.stringify(message));
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
			addJoinedMember(member) {
				setGlobalContext("joinedMembers", (list) => {
					const alreadyExists = list.find(
						(x) => x.member_did === member.member_did,
					);
					if (alreadyExists) return list;
					return [...list, member];
				});
			},
			addRemovedMember(member) {
				setGlobalContext("removedMembers", (list) => {
					const alreadyExists = list.find(
						(x) => x.member_did === member.member_did,
					);
					if (alreadyExists) return list;
					return [...list, member];
				});
			},
			clearOptimisticMemberUpdates() {
				setGlobalContext("joinedMembers", []);
				setGlobalContext("removedMembers", []);
			},
			setUserData(data) {
				setGlobalContext("user", data);
			},
			setMemberListVisible(state) {
				if (typeof state === "boolean") {
					setGlobalContext("uiStates", (current) => ({
						...current,
						membersListVisible: state,
					}));
					setUserPreferences("membersListVisible", state);
				} else {
					setGlobalContext("uiStates", (current) => ({
						...current,
						membersListVisible: state(current.membersListVisible),
					}));
					setUserPreferences("membersListVisible", (current) => state(current));
				}
			},
			addMemberProfileOverride(data) {
				const existingIndex = globalContext.memberProfileOverrides.findIndex(
					(x) => x.did === data.did,
				);

				if (existingIndex !== -1) {
					setGlobalContext("memberProfileOverrides", existingIndex, data);
				} else {
					setGlobalContext("memberProfileOverrides", (list) => [...list, data]);
				}
			},
			addMemberStatusOverride(data) {
				const existingIndex = globalContext.memberStatusOverrides.findIndex(
					(x) => x.did === data.did,
				);

				if (existingIndex !== -1) {
					setGlobalContext("memberStatusOverrides", existingIndex, data);
				} else {
					setGlobalContext("memberStatusOverrides", (list) => [...list, data]);
				}
			},
			clearMemberOverrides() {
				setGlobalContext("memberProfileOverrides", []);
				setGlobalContext("memberStatusOverrides", []);
			},
			updateUserOnlineState(state) {
				const existingIndex = globalContext.userOnlineStates.findIndex(
					(x) => x.did === state.did,
				);

				if (existingIndex !== -1) {
					setGlobalContext("userOnlineStates", existingIndex, state);
				} else {
					setGlobalContext("userOnlineStates", (list) => [...list, state]);
				}
			},
			processVoiceChannelUpdate(channelInfo) {
				const existingIndex = globalContext.knownVoiceChannelStates.findIndex(
					(x) =>
						x.community_uri === channelInfo.community_uri &&
						x.channel_rkey === channelInfo.channel_rkey,
				);

				if (existingIndex !== -1) {
					const newArray = globalContext.knownVoiceChannelStates.toSpliced(
						existingIndex,
						1,
						channelInfo,
					);
					setGlobalContext("knownVoiceChannelStates", newArray);
				} else {
					setGlobalContext("knownVoiceChannelStates", (list) => [
						...list,
						channelInfo,
					]);
				}
			},
		},
	];

	createEffect(() => {
		const _ = globalContext; // Track

		context[1].sendSocketMessage({ action: "activity" });
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
