import type {
	BridgeBackfillStatus,
	BridgeLink,
	BridgePairingView,
	BridgeRegistrationView,
	BridgeRemoteRoom,
	Did,
	SpaceRef,
} from "../types";
import { asDatetime, asDid, tidFor } from "./refs";
import type { World } from "./world";

const DAY = 24 * 60 * 60_000;

type BridgeService = {
	platform: string;
	bridge: Did;
	bridgeHandle: string;
	remoteSpace: string;
	remoteSpaceName: string;
	rooms: BridgeRemoteRoom[];
};

const SERVICES: Record<string, BridgeService> = {
	matrix: {
		platform: "matrix",
		bridge: asDid("did:web:matrix-bridge.colibri.social"),
		bridgeHandle: "matrix-bridge.colibri.social",
		remoteSpace: "!trailheads:matrix.org",
		remoteSpaceName: "Trailheads on Matrix",
		rooms: [
			{ id: "!lobby:matrix.org", name: "lobby", kind: "text" },
			{ id: "!summits:matrix.org", name: "summits", kind: "text" },
			{
				id: "!photos:matrix.org",
				name: "photos",
				kind: "text",
				parent: "Media",
			},
			{ id: "!campfire:matrix.org", name: "campfire", kind: "voice" },
		],
	},
	telegram: {
		platform: "telegram",
		bridge: asDid("did:web:telegram-bridge.example.social"),
		bridgeHandle: "telegram-bridge.example.social",
		remoteSpace: "-100248613",
		remoteSpaceName: "Weekend hikers",
		rooms: [
			{ id: "general", name: "General", kind: "text" },
			{ id: "routes", name: "Route planning", kind: "forum" },
			{ id: "announcements", name: "Announcements", kind: "announcement" },
		],
	},
	irc: {
		platform: "irc",
		bridge: asDid("did:web:irc-relay.example.net"),
		bridgeHandle: "irc-relay.example.net",
		remoteSpace: "irc.libera.chat",
		remoteSpaceName: "Libera Chat",
		rooms: [
			{ id: "#colibri-dev", name: "#colibri-dev", kind: "text" },
			{ id: "#colibri", name: "#colibri", kind: "text" },
		],
	},
};

export const PAIRING_CODE_PATTERN = /^[A-Z2-9]{8}$/;

const serviceForCode = (code: string) => {
	if (code.startsWith("M")) return SERVICES.matrix as BridgeService;
	if (code.startsWith("I")) return SERVICES.irc as BridgeService;
	return SERVICES.telegram as BridgeService;
};

export const normalizePairingCode = (code: string) =>
	code.trim().toUpperCase().replace(/[\s-]/g, "");

export const createBridgeStore = (world: World, now: number) => {
	const registrations = new Map<Did, BridgeRegistrationView[]>();
	const services = new Map<string, BridgeService>();
	const redeemed = new Set<string>();

	const seed = (input: {
		spaceKey: string;
		channelSkey: string;
		service: BridgeService;
		remoteSpaceName: string;
		remoteRoom: string;
		remoteName: string;
		daysAgo: number;
		imported: number;
	}) => {
		const space = world.spaces.find(
			(entry) => entry.seed.key === input.spaceKey,
		);
		const channel = space?.channels.find((entry) =>
			entry.view.space.endsWith(`/${input.channelSkey}`),
		);
		if (!space || !channel) return;
		const id = tidFor(now - input.daysAgo * DAY, world.nextClock());
		const requestedAt = asDatetime(now - (input.daysAgo - 1) * DAY);
		services.set(id, input.service);
		registrations.set(space.did, [
			...(registrations.get(space.did) ?? []),
			{
				id,
				community: space.did,
				bridge: input.service.bridge,
				bridgeHandle: input.service.bridgeHandle as never,
				platform: input.service.platform,
				remoteSpace: input.service.remoteSpace,
				remoteSpaceName: input.remoteSpaceName,
				links: [
					{
						channel: channel.view.space,
						remoteRoom: input.remoteRoom,
						remoteName: input.remoteName,
						backfill: { requestedAt },
					},
				],
				backfills: [
					{
						channel: channel.view.space,
						requestedAt,
						state: "done",
						imported: input.imported,
						from: asDatetime(now - 400 * DAY),
						until: requestedAt,
						updatedAt: asDatetime(now - (input.daysAgo - 2) * DAY),
					},
				],
				enabled: true,
				mirrorModeration: true,
				createdBy: world.viewerDid,
				createdAt: asDatetime(now - input.daysAgo * DAY),
			},
		]);
	};

	seed({
		spaceKey: "trail",
		channelSkey: "matrix",
		service: SERVICES.matrix as BridgeService,
		remoteSpaceName: "Trailheads on Matrix",
		remoteRoom: "!lobby:matrix.org",
		remoteName: "lobby",
		daysAgo: 40,
		imported: 1_284,
	});
	seed({
		spaceKey: "hq",
		channelSkey: "dev",
		service: SERVICES.irc as BridgeService,
		remoteSpaceName: "Libera Chat",
		remoteRoom: "#colibri-dev",
		remoteName: "#colibri-dev",
		daysAgo: 12,
		imported: 312,
	});

	const listFor = (community: Did) => registrations.get(community) ?? [];

	const find = (community: Did, registration: string) => {
		const found = listFor(community).find((entry) => entry.id === registration);
		if (!found) throw new Error("That bridge isn't connected anymore.");
		return found;
	};

	const pairing = (code: string): BridgePairingView => {
		const normalized = normalizePairingCode(code);
		if (!PAIRING_CODE_PATTERN.test(normalized) || redeemed.has(normalized)) {
			throw new Error("That pairing code did not work.");
		}
		const service = serviceForCode(normalized);
		return {
			bridge: service.bridge,
			bridgeHandle: service.bridgeHandle as never,
			platform: service.platform,
			remoteSpace: service.remoteSpace,
			remoteSpaceName: service.remoteSpaceName,
			expiresAt: asDatetime(Date.now() + 15 * 60_000),
		};
	};

	const redeem = (community: Did, code: string) => {
		const view = pairing(code);
		const normalized = normalizePairingCode(code);
		redeemed.add(normalized);
		const id = tidFor(Date.now(), world.nextClock());
		services.set(id, serviceForCode(normalized));
		const registration: BridgeRegistrationView = {
			id,
			community,
			bridge: view.bridge,
			bridgeHandle: view.bridgeHandle,
			platform: view.platform,
			remoteSpace: view.remoteSpace,
			remoteSpaceName: view.remoteSpaceName,
			links: [],
			enabled: true,
			createdBy: world.viewerDid,
			createdAt: asDatetime(Date.now()),
		};
		registrations.set(community, [registration, ...listFor(community)]);
		return registration;
	};

	const backfillFor = (
		link: BridgeLink,
		previous: BridgeRegistrationView,
	): BridgeBackfillStatus | undefined => {
		if (!link.backfill) return undefined;
		const existing = previous.backfills?.find(
			(status) =>
				status.channel === link.channel &&
				status.requestedAt === link.backfill?.requestedAt,
		);
		if (existing) return existing;
		return {
			channel: link.channel as SpaceRef,
			requestedAt: link.backfill.requestedAt,
			state: "running",
			imported: 0,
			from: link.backfill.since ?? asDatetime(Date.now() - 365 * DAY),
			until: link.backfill.requestedAt,
			updatedAt: asDatetime(Date.now()),
		};
	};

	const update = (input: {
		community: Did;
		registration: string;
		links?: BridgeLink[];
		enabled?: boolean;
		mirrorModeration?: boolean;
	}) => {
		const previous = find(input.community, input.registration);
		const next: BridgeRegistrationView = {
			...previous,
			updatedAt: asDatetime(Date.now()),
		};
		if (input.links) {
			next.links = input.links;
			next.backfills = input.links
				.map((link) => backfillFor(link, previous))
				.filter((status): status is BridgeBackfillStatus => !!status);
		}
		if (input.enabled !== undefined) next.enabled = input.enabled;
		if (input.mirrorModeration !== undefined)
			next.mirrorModeration = input.mirrorModeration;
		registrations.set(
			input.community,
			listFor(input.community).map((entry) =>
				entry.id === next.id ? next : entry,
			),
		);
		return next;
	};

	const advance = (community: Did) => {
		const list = listFor(community);
		let changed = false;
		const next = list.map((entry) => {
			if (
				!entry.enabled ||
				!entry.backfills?.some((s) => s.state === "running")
			)
				return entry;
			changed = true;
			return {
				...entry,
				backfills: entry.backfills.map((status) => {
					if (status.state !== "running") return status;
					const imported = status.imported + 180;
					return imported >= 900
						? {
								...status,
								imported,
								state: "done",
								reached: status.until,
								updatedAt: asDatetime(Date.now()),
							}
						: {
								...status,
								imported,
								reached: asDatetime(
									Date.parse(status.from) +
										(imported / 900) *
											(Date.parse(status.until) - Date.parse(status.from)),
								),
								updatedAt: asDatetime(Date.now()),
							};
				}),
			};
		});
		if (changed) registrations.set(community, next);
		return next;
	};

	return {
		list: (community: Did) => advance(community),
		rooms: (community: Did, registration: string) => {
			find(community, registration);
			return services.get(registration)?.rooms ?? [];
		},
		pairing,
		redeem,
		update,
		revoke: (community: Did, registration: string) => {
			find(community, registration);
			registrations.set(
				community,
				listFor(community).filter((entry) => entry.id !== registration),
			);
		},
	};
};
