import { COLLECTIONS } from "@colibri-social/lexicons";
import {
	type ClientFrame,
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
	setPresenceFrame,
	spaceAuthority,
	spaceSkey,
	typingFrame,
	viewChannelFrame,
} from "@colibri-social/lib";
import { resolvePdsHost } from "../../auth/identity";
import type { InvitationPreview, JoinResult } from "../access";
import { type ChannelSummary, summarizeMessage } from "../channel-summary";
import type { EmojiSource } from "../emoji";
import { importLegacyPreferences } from "../preferences/legacy";
import {
	createPreferencesSpace,
	createRemotePreferenceBackend,
} from "../preferences/remote";
import {
	createPreferenceStore,
	preferencesSnapshotKey,
} from "../preferences/store";
import type {
	ControlsPreferences,
	DataSource,
	LiveEvent,
	Simulation,
} from "../source";
import {
	type CategoryView,
	type ChannelView,
	type CommunityView,
	type Did,
	type GifView,
	type MemberView,
	type MessageView,
	type ProfileView,
	type RoleView,
	type SpaceRef,
	TEXT_CHANNEL,
} from "../types";
import { fetchBlueskyPost } from "./bluesky";
import { createDeletion } from "./deletion";
import {
	createMessageIndex,
	createMessageWrites,
	createUploads,
} from "./messages";
import { createReadCursorWriter } from "./read-cursors";
import { createRecords } from "./records";
import { createTransport, type RemoteSession } from "./transport";

const log = createLogger("remote/source");

const PROFILE_COLLECTION = "social.colibri.beta.actor.profile";
const THREAD_FOLLOW_COLLECTION = "social.colibri.beta.thread.follow";
const SUMMARY_CONCURRENCY = 4;

export type RemoteLive = {
	subscribe: (listener: (event: LiveEvent) => void) => () => void;
	send: (frame: ClientFrame) => unknown;
	watch: (target: {
		communities?: ReadonlyArray<string>;
		channels?: ReadonlyArray<string>;
	}) => () => void;
};

export type RemoteDataSource = DataSource & {
	flushReadCursors: () => Promise<void>;
	watchChannel: (channel: SpaceRef) => () => void;
	viewChannel: (channel?: SpaceRef) => void;
};

export type RemoteSourceOptions = {
	session: RemoteSession;
	appViewDid: string;
	live: RemoteLive;
	controls?: Partial<ControlsPreferences>;
	cachedViewer?: ProfileView;
	onScopesRejected?: () => void;
};

export const DEFAULT_REMOTE_CONTROLS: ControlsPreferences = {
	showMessagePreviews: true,
	swipeLeftAction: "members",
	doubleTapEnabled: false,
	doubleTapAction: "react",
	doubleTapReactionEmoji: "👍",
	developerMode: false,
	confirmVoiceJoin: false,
};

export const notEnabled = (method: string) =>
	new ColibriError({ code: "NotEnabled", method });

export const isNotEnabled = (error: unknown) =>
	error instanceof ColibriError && error.code === "NotEnabled";

const rejectNotEnabled = (method: string) => () =>
	Promise.reject(notEnabled(method));

const appViewOrigin = (did: string) => {
	if (!did.startsWith("did:web:")) return undefined;
	const host = decodeURIComponent(did.slice("did:web:".length));
	return host.startsWith("localhost")
		? `http://${host.replace("localhost", "127.0.0.1")}`
		: `https://${host}`;
};

const mapLimit = async <T, R>(
	items: readonly T[],
	limit: number,
	run: (item: T) => Promise<R>,
): Promise<R[]> => {
	const results: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const position = next++;
			results[position] = await run(items[position] as T);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, worker),
	);
	return results;
};

export const createRemoteSource = async (
	options: RemoteSourceOptions,
): Promise<RemoteDataSource> => {
	const transport = createTransport({
		session: options.session,
		appViewDid: options.appViewDid,
	});
	const records = createRecords(transport);
	const index = createMessageIndex();
	const uploads = createUploads();

	const fetchProfile = () =>
		transport
			.query(colibri.actor.getProfile.main, {
				params: { actor: options.session.did },
			})
			.then((result) => result.profile as ProfileView);
	const localListeners = new Set<(event: LiveEvent) => void>();
	const emitLocal = (event: LiveEvent) => {
		for (const listener of localListeners) listener(event);
	};

	const preferencesSpace = createPreferencesSpace(transport);
	const deletion = createDeletion({
		transport,
		records,
		space: preferencesSpace,
	});
	const preferences = createPreferenceStore({
		backend: createRemotePreferenceBackend({
			transport,
			records,
			space: preferencesSpace,
		}),
		controls: { ...DEFAULT_REMOTE_CONTROLS, ...options.controls },
		snapshotKey: preferencesSnapshotKey(options.session.did),
		onScopesRejected: options.onScopesRejected,
	});

	const loadPreferences = () =>
		preferences.refresh().then(async (loaded) => {
			if (loaded)
				await importLegacyPreferences(preferences, options.session.did);
		});

	let viewer: ProfileView;
	if (options.cachedViewer) {
		viewer = options.cachedViewer;
		void loadPreferences();
		void fetchProfile().then(
			(profile) => {
				viewer = { ...profile, presence: viewer.presence ?? profile.presence };
				emitLocal({ $type: "viewerEvent", profile: viewer });
			},
			(error: unknown) =>
				log.warn("could not refresh the profile", {
					code: classifyThrown(error).code,
				}),
		);
	} else {
		const [profile] = await Promise.all([fetchProfile(), loadPreferences()]);
		viewer = profile;
	}

	options.live.subscribe((event) => {
		index.observe(event);
		if (event.$type === "presenceEvent" && event.did === viewer.did)
			viewer = { ...viewer, presence: event.presence };
	});

	const readCursorStatuses = async (community: string) =>
		(
			await transport.query(colibri.channel.listUnreadStatus.main, {
				params: { community },
			})
		).statuses;
	const cursorsOf = (
		statuses: Awaited<ReturnType<typeof readCursorStatuses>>,
	) =>
		statuses.flatMap((status) => {
			const channel = spaceSkey(status.channel);
			return channel && status.cursor
				? [{ channel, cursor: status.cursor }]
				: [];
		});
	const readCursors = createReadCursorWriter({
		hydrate: async (community) =>
			cursorsOf(await readCursorStatuses(community)),
		persist: async (community, cursors) => {
			await preferencesSpace.write(() =>
				records.putInSpace(
					{
						space: preferencesSpace.space,
						collection: COLLECTIONS.channelRead,
						rkey: community,
					},
					{ community, cursors },
				),
			);
		},
		push: async (community, cursors) => {
			await transport.procedure(colibri.channel.putReadCursors.main, {
				body: { community, cursors },
			});
		},
	});
	options.live.subscribe((event) => {
		if (event.$type === "readCursorEvent") {
			readCursors.adopt(event.community, event.cursors);
		}
		if (event.$type === "preferencesEvent")
			preferences.adopt(event.preferences);
	});
	if (typeof window !== "undefined") {
		const flush = () => void readCursors.flush();
		window.addEventListener("blur", flush);
		window.addEventListener("beforeunload", flush);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
	}

	const writes = createMessageWrites({
		transport,
		records,
		index,
		uploads,
		viewer: () => viewer,
	});

	const listMessages: DataSource["listMessages"] = async (params) => {
		const result = await transport.query(colibri.channel.listMessages.main, {
			params: {
				channel: params.channel,
				limit: params.limit,
				cursor: params.cursor,
				reverse: params.reverse,
			},
		});
		const items = result.messages as MessageView[];
		for (const message of items) index.put(message);
		return result.cursor ? { items, cursor: result.cursor } : { items };
	};

	const listChannels = async (community: Did) =>
		(
			await transport.query(colibri.community.listChannels.main, {
				params: { community },
			})
		).channels as ChannelView[];

	const emojiNotEnabled: Omit<EmojiSource, "emojiBlobUrl"> = {
		listEmoji: rejectNotEnabled("emoji.list"),
		uploadEmoji: rejectNotEnabled("emoji.upload"),
		renameEmoji: rejectNotEnabled("emoji.rename"),
		deleteEmoji: rejectNotEnabled("emoji.delete"),
		createEmojiPack: rejectNotEnabled("emoji.createPack"),
		updateEmojiPack: rejectNotEnabled("emoji.updatePack"),
		deleteEmojiPack: rejectNotEnabled("emoji.deletePack"),
		followEmoji: rejectNotEnabled("emoji.follow"),
		unfollowEmoji: rejectNotEnabled("emoji.unfollow"),
		followEmojiPack: rejectNotEnabled("emoji.followPack"),
		unfollowEmojiPack: rejectNotEnabled("emoji.unfollowPack"),
	};

	const origin = appViewOrigin(options.appViewDid);

	let releaseCommunities: (() => void) | undefined;
	const watchCommunities = (communities: readonly CommunityView[]) => {
		const release = options.live.watch({
			communities: communities.map((community) => community.did),
		});
		releaseCommunities?.();
		releaseCommunities = release;
	};

	const source: RemoteDataSource = {
		...emojiNotEnabled,
		emojiBlobUrl: (blob) => {
			const query = new URLSearchParams({ did: blob.did, cid: blob.cid });
			return `${origin ?? ""}/xrpc/${colibri.blob.get.main.nsid}?${query}`;
		},

		viewer: () => viewer,

		listCommunities: async () => {
			const communities = (
				await transport.query(colibri.actor.listCommunities.main)
			).communities as CommunityView[];
			watchCommunities(communities);
			return communities;
		},
		watchChannel: (channel) => {
			const release = options.live.watch({ channels: [channel] });
			let watching = true;
			return () => {
				if (!watching) return;
				watching = false;
				release();
			};
		},
		viewChannel: (channel) => {
			options.live.send(viewChannelFrame(channel));
		},
		getCommunity: async (community) =>
			(
				await transport.query(colibri.community.getCommunity.main, {
					params: { community },
				})
			).community as CommunityView,
		createCommunity: async (input) =>
			(
				await transport.procedure(colibri.community.create.main, {
					body: input,
				})
			).community as CommunityView,
		updateCommunity: async (input) =>
			(
				await transport.procedure(colibri.community.update.main, {
					body: input,
				})
			).community as CommunityView,
		putCommunityImage: async (input) => {
			input.onProgress?.(0);
			const result = await transport.procedure(
				colibri.community.putImage.main,
				{
					params: { community: input.community, kind: input.kind },
					raw: { data: input.file, encoding: input.file.type || "image/*" },
				},
			);
			input.onProgress?.(1);
			return result.community as CommunityView;
		},
		deleteCommunityImage: async (input) =>
			(
				await transport.procedure(colibri.community.deleteImage.main, {
					params: { community: input.community, kind: input.kind },
				})
			).community as CommunityView,
		deleteCommunity: async (input) => {
			await transport.procedure(colibri.community.delete.main, { body: input });
		},
		leaveCommunity: async (input) => {
			await transport.procedure(colibri.community.leave.main, { body: input });
		},
		accountHost: () => resolvePdsHost(options.session.did),
		getDeletionStatus: deletion.getDeletionStatus,
		deleteColibriData: deletion.deleteColibriData,
		transferOwnership: rejectNotEnabled("community.transferOwnership"),
		listDiscoverable: rejectNotEnabled("community.listDiscoverable"),

		listBridges: async (community) =>
			(
				await transport.query(colibri.bridge.listRegistrations.main, {
					params: { community },
				})
			).registrations,
		listBridgeRooms: async (input) =>
			(
				await transport.query(colibri.bridge.listRemoteRooms.main, {
					params: input,
				})
			).rooms,
		getBridgePairing: async (code) =>
			(
				await transport.query(colibri.bridge.getPairing.main, {
					params: { code },
				})
			).pairing,
		redeemBridgePairing: async (input) =>
			(
				await transport.procedure(colibri.bridge.redeemPairing.main, {
					body: input,
				})
			).registration,
		updateBridge: async (input) =>
			(
				await transport.procedure(colibri.bridge.update.main, {
					body: input,
				})
			).registration,
		revokeBridge: async (input) => {
			await transport.procedure(colibri.bridge.revoke.main, { body: input });
		},

		listCategories: async (community) =>
			(
				await transport.query(colibri.community.listCategories.main, {
					params: { community },
				})
			).categories as CategoryView[],
		listChannels,
		listChannelSummaries: async (community) => {
			const channels = (await listChannels(community)).filter(
				(channel) => channel.type === TEXT_CHANNEL,
			);
			const latest = await mapLimit(
				channels,
				SUMMARY_CONCURRENCY,
				async (channel): Promise<ChannelSummary | undefined> => {
					try {
						const page = await listMessages({
							channel: channel.space,
							limit: 1,
						});
						const last = page.items[0];
						return last ? summarizeMessage(last) : undefined;
					} catch (error) {
						log.warn("could not load a channel preview", {
							code: classifyThrown(error).code,
						});
						return undefined;
					}
				},
			);
			return latest.filter((entry): entry is ChannelSummary => !!entry);
		},
		createChannel: async (input) =>
			(
				await transport.procedure(colibri.channel.create.main, {
					body: input,
				})
			).channel as ChannelView,
		updateChannel: async (input) =>
			(
				await transport.procedure(colibri.channel.update.main, {
					body: input,
				})
			).channel as ChannelView,
		deleteChannel: async (input) => {
			await transport.procedure(colibri.channel.delete.main, { body: input });
		},
		createCategory: async (input) =>
			(
				await transport.procedure(colibri.category.create.main, {
					body: input,
				})
			).category as CategoryView,
		updateCategory: async (input) =>
			(
				await transport.procedure(colibri.category.update.main, {
					body: input,
				})
			).category as CategoryView,
		deleteCategory: async (input) => {
			await transport.procedure(colibri.category.delete.main, { body: input });
		},

		listRoles: async (community) =>
			(
				await transport.query(colibri.community.listRoles.main, {
					params: { community },
				})
			).roles as RoleView[],
		createRole: async (input) =>
			(await transport.procedure(colibri.role.create.main, { body: input }))
				.role as RoleView,
		updateRole: async (input) =>
			(await transport.procedure(colibri.role.update.main, { body: input }))
				.role as RoleView,
		deleteRole: async (input) => {
			await transport.procedure(colibri.role.delete.main, { body: input });
		},
		putRoleBadgeImage: async (input) =>
			(
				await transport.procedure(colibri.role.putBadgeImage.main, {
					params: { community: input.community, role: input.role },
					raw: { data: input.file, encoding: input.file.type || "image/*" },
				})
			).role as RoleView,

		listMembers: async (community, paging = {}) => {
			const result = await transport.query(colibri.community.listMembers.main, {
				params: {
					community,
					limit: paging.limit,
					cursor: paging.cursor,
				},
			});
			const items = result.members as MemberView[];
			return result.cursor ? { items, cursor: result.cursor } : { items };
		},
		setMemberRoles: async (input) => {
			await transport.procedure(colibri.community.setMemberRoles.main, {
				body: input,
			});
		},
		kickMember: async (input) => {
			await transport.procedure(colibri.community.kick.main, { body: input });
		},
		banMember: async (input) => {
			await transport.procedure(colibri.community.ban.main, { body: input });
		},

		listApplications: async (input) =>
			(
				await transport.query(colibri.community.listApplications.main, {
					params: {
						community: input.community,
						includeDismissed: input.includeDismissed,
					},
				})
			).applications,
		approveApplication: async (input) =>
			(
				await transport.procedure(colibri.community.approveApplication.main, {
					body: input,
				})
			).member as MemberView,
		dismissApplication: async (input) => {
			await transport.procedure(colibri.community.dismissApplication.main, {
				body: input,
			});
		},
		undismissApplication: async (input) => {
			await transport.procedure(colibri.community.undismissApplication.main, {
				body: input,
			});
		},
		listBans: async (community) =>
			(
				await transport.query(colibri.community.listBans.main, {
					params: { community },
				})
			).bans,
		unban: async (input) => {
			await transport.procedure(colibri.community.unban.main, { body: input });
		},
		listInvitations: async (community) =>
			(
				await transport.query(colibri.community.listInvitations.main, {
					params: { community },
				})
			).invitations,
		createInvitation: async (input) =>
			(
				await transport.procedure(colibri.community.createInvitation.main, {
					body: input,
				})
			).invitation,
		deleteInvitation: async (input) => {
			await transport.procedure(colibri.community.deleteInvitation.main, {
				body: input,
			});
		},
		getInvitation: async (code) =>
			(await transport.query(colibri.community.getInvitation.main, {
				params: { code },
			})) as InvitationPreview,
		joinCommunity: async (input) =>
			(await transport.procedure(colibri.community.join.main, {
				body: input,
			})) as JoinResult,

		listMessages,
		sendMessage: writes.sendMessage,
		editMessage: writes.editMessage,
		deleteMessage: writes.deleteMessage,
		react: writes.react,
		setHidden: writes.setHidden,
		setSuppressedEmbeds: writes.setSuppressedEmbeds,
		setModeratedEmbeds: writes.setModeratedEmbeds,
		forwardMessage: writes.forwardMessage,
		uploadBlob: writes.uploadBlob,
		markRead: (channel, through) =>
			writes.markRead(
				channel,
				async () => {
					const page = await listMessages({ channel, limit: 1 });
					return page.items[0]?.rkey;
				},
				readCursors.record,
				through,
			),
		flushReadCursors: () => readCursors.flush(),
		listUnreadStatus: async (community) => {
			const statuses = await readCursorStatuses(community);
			readCursors.adopt(community, cursorsOf(statuses));
			return statuses;
		},

		listThreads: async (channel) => {
			const community = spaceAuthority(channel);
			if (!community)
				throw new ColibriError({
					code: "ChannelNotFound",
					method: colibri.thread.listThreads.main.nsid,
				});
			return (
				await transport.query(colibri.thread.listThreads.main, {
					params: { community, channel },
				})
			).threads;
		},
		createThread: async (input) =>
			(
				await transport.procedure(colibri.thread.create.main, {
					body: input,
				})
			).thread,
		updateThread: async (input) =>
			(
				await transport.procedure(colibri.thread.update.main, {
					body: input,
				})
			).thread,
		deleteThread: async (input) => {
			await transport.procedure(colibri.thread.delete.main, { body: input });
		},
		repoint: async (input) =>
			(
				await transport.procedure(colibri.thread.repoint.main, {
					body: input,
				})
			).thread,
		moveMessages: async (input) =>
			transport.procedure(colibri.thread.moveMessages.main, { body: input }),
		followThread: async (input) => {
			const target = {
				space: input.thread,
				collection: THREAD_FOLLOW_COLLECTION,
				rkey: "self",
			};
			if (input.follow) {
				await records.putInSpace(target, {
					createdAt: new Date().toISOString(),
				});
				return;
			}
			await records.deleteInSpace(target);
		},

		listNotifications: async (params = {}) => {
			const result = await transport.query(
				colibri.notification.listNotifications.main,
				{ params: { limit: params.limit, cursor: params.cursor } },
			);
			const items = result.notifications;
			return result.cursor ? { items, cursor: result.cursor } : { items };
		},
		updateSeen: async (input) => {
			await transport.procedure(colibri.notification.updateSeen.main, {
				body: input,
			});
		},
		updateSeenForMessage: async (input) => {
			await transport.procedure(
				colibri.notification.updateSeenForMessage.main,
				{ body: input },
			);
		},

		subscribe: (listener) => {
			localListeners.add(listener);
			const release = options.live.subscribe(listener);
			return () => {
				localListeners.delete(listener);
				release();
			};
		},
		typing: (channel: SpaceRef) => {
			options.live.send(typingFrame(channel));
		},

		putProfile: async (input) => {
			const existing = await records.getInRepo(PROFILE_COLLECTION, "self");
			const record: Record<string, unknown> = {
				...((existing?.value ?? {}) as Record<string, unknown>),
				syncBluesky: input.syncBluesky,
			};
			if (input.displayName !== undefined)
				record.displayName = input.displayName;
			if (input.description !== undefined)
				record.description = input.description;
			if (input.theme !== undefined) record.theme = input.theme;
			for (const field of ["avatar", "banner"] as const) {
				const value = input[field];
				if (value === null) delete record[field];
				else if (value) {
					const blob = uploads.blobFor(value.url);
					if (!blob)
						throw new ColibriError({
							code: "UploadFailed",
							method: "profile.put",
						});
					record[field] = blob;
				}
			}
			delete record.$type;
			await records.putInRepo(PROFILE_COLLECTION, "self", record);
			const refreshed = await transport.query(colibri.actor.getProfile.main, {
				params: { actor: viewer.did },
			});
			viewer = { ...(refreshed.profile as ProfileView) };
			return viewer;
		},
		setStatus: async (input) => {
			const result = await transport.procedure(colibri.actor.setStatus.main, {
				body: input,
			});
			viewer = { ...viewer, presence: result.presence };
			return result.presence;
		},
		setVoice: async (voice) => {
			options.live.send(setPresenceFrame({ voice: voice as never }));
			const presence = {
				...(viewer.presence ?? { onlineState: "online" }),
			};
			if (voice) presence.voice = voice;
			else delete presence.voice;
			viewer = { ...viewer, presence };
			return presence;
		},

		listGifs: async (query) => {
			const trimmed = query?.trim();
			const result = trimmed
				? await transport.query(colibri.embed.searchGifs.main, {
						params: { q: trimmed },
					})
				: await transport.query(colibri.embed.trendingGifs.main);
			return result.gifs as GifView[];
		},
		gifFavorites: () => preferences.gifFavorites(),
		setGifFavorite: (gif, favorite) => {
			void preferences.setGifFavorite(gif, favorite);
		},

		getBlueskyPost: (url) => fetchBlueskyPost(url),

		simulation: (): Simulation => ({ slowNetwork: false }),
		setSimulation: () => {},
		preferences,
	};

	return source;
};
