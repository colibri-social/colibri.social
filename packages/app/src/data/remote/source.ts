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
import { isNativeShell } from "../../auth/native";
import type { InvitationPreview, JoinResult } from "../access";
import { createActivitySourceDetector } from "../activity-source";
import { createNetworkLabeler } from "../badges/labeler";
import { summarizeChannel } from "../channel-summary";
import { createPreferencesGrant } from "../preferences/grant";
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
	ProfileSeed,
	ProfileTheme,
	Simulation,
} from "../source";
import { createSupporterLinkTransport } from "../supporter-link";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	Did,
	GifView,
	LegacyCommunityView,
	MemberView,
	MessageView,
	ProfileView,
	RoleView,
	SpaceRef,
	ThreadView,
} from "../types";
import { fetchBlueskyPost } from "./bluesky";
import { createDeletion } from "./deletion";
import { appViewOrigin, createRemoteEmoji, emojiBlobLocator } from "./emoji";
import {
	createMessageIndex,
	createMessageWrites,
	createUploads,
} from "./messages";
import { createReadCursorWriter } from "./read-cursors";
import { type BlobRef, createRecords } from "./records";
import { createTransferOwnership } from "./transfer";
import { createTransport, type RemoteSession } from "./transport";

const log = createLogger("remote/source");

const PROFILE_COLLECTION = "social.colibri.beta.actor.profile";
const INVALID_HANDLE = "handle.invalid";
const LEGACY_PROFILE_COLLECTION = "social.colibri.actor.profile";
const BLUESKY_PROFILE_COLLECTION = "app.bsky.actor.profile";
const THREAD_FOLLOW_COLLECTION = "social.colibri.beta.thread.follow";

type ProfileRecordValue = Record<string, unknown> & { syncBluesky?: unknown };

const textOf = (value: unknown) =>
	typeof value === "string" && value.trim() ? value : undefined;

const THREAD_PAGE_SIZE = 100;
const THREAD_PAGES = 5;

export type RemoteLive = {
	subscribe: (listener: (event: LiveEvent) => void) => () => void;
	send: (frame: ClientFrame) => unknown;
	watch: (target: {
		communities?: ReadonlyArray<string>;
		channels?: ReadonlyArray<string>;
	}) => () => void;
};

export type RemoteDataSource = DataSource & {
	startPreferencesGrant: () => () => void;
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

	const sessionHandle = async () => {
		try {
			const session = await transport.pdsQuery<{
				handle?: ProfileView["handle"];
			}>("com.atproto.server.getSession");
			return session.handle;
		} catch (thrown) {
			log.warn("could not read the session handle", {
				code: classifyThrown(thrown).code,
			});
			return undefined;
		}
	};
	const fetchProfile = async () => {
		const result = await transport.query(colibri.actor.getProfile.main, {
			params: { actor: options.session.did },
		});
		const profile = result.profile as ProfileView;
		if (profile.handle !== INVALID_HANDLE) return profile;
		const handle = await sessionHandle();
		return handle && handle !== INVALID_HANDLE
			? { ...profile, handle }
			: profile;
	};
	const localListeners = new Set<(event: LiveEvent) => void>();
	const emitLocal = (event: LiveEvent) => {
		for (const listener of localListeners) listener(event);
	};

	const imageOf = async (blob: unknown) => {
		const cid = (blob as BlobRef | undefined)?.ref?.$link;
		if (!cid) return undefined;
		try {
			return await transport.pdsBlob(cid);
		} catch (error) {
			log.warn("could not load a profile image", {
				code: classifyThrown(error).code,
			});
			return undefined;
		}
	};
	const seedOf = async (value: ProfileRecordValue): Promise<ProfileSeed> => {
		const [avatar, banner] = await Promise.all([
			imageOf(value.avatar),
			imageOf(value.banner),
		]);
		return {
			displayName: textOf(value.displayName),
			description: textOf(value.description),
			pronouns: textOf(value.pronouns),
			avatar,
			banner,
			theme: value.theme as ProfileTheme | undefined,
		};
	};

	const preferencesSpace = createPreferencesSpace(transport);
	const preferencesGrant = createPreferencesGrant({
		transport,
		space: preferencesSpace,
	});
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
	let presenceSinceStart = false;
	if (options.cachedViewer) {
		viewer = options.cachedViewer;
		void loadPreferences();
		void fetchProfile().then(
			(profile) => {
				viewer = {
					...profile,
					presence: presenceSinceStart ? viewer.presence : profile.presence,
				};
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
		if (event.$type === "presenceEvent" && event.did === viewer.did) {
			presenceSinceStart = true;
			viewer = { ...viewer, presence: event.presence };
		}
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
				around: params.around,
			},
		});
		const items = result.messages as MessageView[];
		for (const message of items) index.put(message);
		return {
			items,
			...(result.cursor ? { cursor: result.cursor } : {}),
			...(result.forwardCursor ? { forwardCursor: result.forwardCursor } : {}),
		};
	};

	const listChannels = async (community: Did) =>
		(
			await transport.query(colibri.community.listChannels.main, {
				params: { community },
			})
		).channels as ChannelView[];

	const emojiBlobUrl = emojiBlobLocator(appViewOrigin(options.appViewDid));
	const { observe: observeEmoji, ...emoji } = createRemoteEmoji({
		transport,
		records,
		space: preferencesSpace,
		viewer: options.session.did as Did,
		locate: emojiBlobUrl,
		emit: emitLocal,
	});
	options.live.subscribe(observeEmoji);

	let releaseCommunities: (() => void) | undefined;
	const watchCommunities = (communities: readonly CommunityView[]) => {
		const release = options.live.watch({
			communities: communities.map((community) => community.did),
		});
		releaseCommunities?.();
		releaseCommunities = release;
	};

	const source: RemoteDataSource = {
		startPreferencesGrant: preferencesGrant.start,
		...emoji,
		emojiBlobUrl,

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
		listLegacyCommunities: async () =>
			(
				await transport.query(colibri.community.listMigratable.main, {
					params: { includeUnadministered: true },
				})
			).communities as LegacyCommunityView[],
		migrateLegacyCommunity: async (community) =>
			(
				await transport.procedure(colibri.community.migrate.main, {
					body: { community },
				})
			).community as LegacyCommunityView,
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
		accountHost: async () =>
			options.session.accountHost?.() ?? resolvePdsHost(options.session.did),
		getDeletionStatus: deletion.getDeletionStatus,
		deleteColibriData: deletion.deleteColibriData,
		transferOwnership: createTransferOwnership(transport),
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
		listChannelSummaries: async (community) =>
			(
				await transport.query(colibri.channel.listSummaries.main, {
					params: { community },
				})
			).summaries.map(summarizeChannel),
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
			const threads: ThreadView[] = [];
			let cursor: string | undefined;
			for (let page = 0; page < THREAD_PAGES; page++) {
				const result = await transport.query(colibri.thread.listThreads.main, {
					params: {
						community,
						channel,
						limit: THREAD_PAGE_SIZE,
						...(cursor ? { cursor } : {}),
					},
				});
				threads.push(...result.threads);
				cursor = result.cursor;
				if (!cursor) break;
			}
			return threads;
		},
		getThread: async (thread) =>
			(
				await transport.query(colibri.thread.getThread.main, {
					params: { thread },
				})
			).thread,
		listThreadMembers: async (thread) =>
			(
				await transport.query(colibri.thread.listMembers.main, {
					params: { thread },
				})
			).members,
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
		clearNotifications: async (input) => {
			await transport.procedure(colibri.notification.clear.main, {
				body: input,
			});
		},
		updateSeenForMessage: async (input) => {
			await transport.procedure(
				colibri.notification.updateSeenForMessage.main,
				{ body: input },
			);
		},
		registerPush: async (input) => {
			await transport.notifProcedure(colibri.notification.registerPush.main, {
				body: input,
			});
		},
		unregisterPush: async (input) => {
			await transport.notifProcedure(colibri.notification.unregisterPush.main, {
				body: input,
			});
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
			if (input.preferredBadge === null) delete record.preferredBadge;
			else if (input.preferredBadge !== undefined)
				record.preferredBadge = input.preferredBadge;
			if (input.pronouns === null) delete record.pronouns;
			else if (input.pronouns !== undefined) record.pronouns = input.pronouns;
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
			viewer = await fetchProfile();
			return viewer;
		},
		loadProfileSetup: async () => {
			const current = await records.getInRepo(PROFILE_COLLECTION, "self");
			const value = current?.value as ProfileRecordValue | undefined;
			if (value && ("pronouns" in value || value.syncBluesky === true))
				return { complete: true };
			const [legacy, bluesky] = await Promise.all([
				value
					? undefined
					: records.getInRepo(LEGACY_PROFILE_COLLECTION, "self"),
				records.getInRepo(BLUESKY_PROFILE_COLLECTION, "self"),
			]);
			const previous =
				value ?? (legacy?.value as ProfileRecordValue | undefined);
			const blueskyValue = bluesky?.value as ProfileRecordValue | undefined;
			const syncedBefore = previous?.syncBluesky === true && !!blueskyValue;
			const [colibriSeed, blueskySeed] = await Promise.all([
				previous && !syncedBefore ? seedOf(previous) : undefined,
				blueskyValue ? seedOf(blueskyValue) : undefined,
			]);
			return { complete: false, colibri: colibriSeed, bluesky: blueskySeed };
		},
		defaultCommunity: async () => {
			const described = await transport.query(
				colibri.server.describeServer.main,
			);
			const community = (described as { defaultCommunity?: unknown })
				.defaultCommunity;
			return typeof community === "string" && community.startsWith("did:")
				? (community as Did)
				: undefined;
		},
		setStatus: async (input) => {
			const result = await transport.procedure(colibri.actor.setStatus.main, {
				body: input,
			});
			presenceSinceStart = true;
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
			presenceSinceStart = true;
			viewer = { ...viewer, presence };
			return presence;
		},
		moderateVoice: async (input) => {
			await transport.procedure(colibri.voice.moderate.main, { body: input });
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

		getProfile: async (actor) =>
			(
				await transport.query(colibri.actor.getProfile.main, {
					params: { actor },
				})
			).profile as ProfileView,

		simulation: (): Simulation => ({ slowNetwork: false, offline: false }),
		setSimulation: () => {},
		preferences,
		labeler: createNetworkLabeler(),
		supporterLink: createSupporterLinkTransport({
			serviceAuth: async (params) =>
				(
					await transport.pdsQuery<{ token: string }>(
						"com.atproto.server.getServiceAuth",
						{ params },
					)
				).token,
			native: isNativeShell,
		}),
		detectActivitySource: createActivitySourceDetector().detect,
	};

	return source;
};
