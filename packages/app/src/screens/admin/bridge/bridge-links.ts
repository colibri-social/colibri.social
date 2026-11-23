import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	BRIDGE_OPEN,
	BRIDGE_UNLINKED,
	type BridgeHistoryDepth,
	type BridgeHistoryImport,
	type BridgeLinkChannel,
	type BridgeRoom,
	toast,
} from "@colibri-social/ui";
import { createMemo, createResource, createSignal } from "solid-js";
import type { BridgeData } from "../../../data/space-directory";
import type {
	BridgeBackfillStatus,
	BridgeLink,
	SpaceRef,
} from "../../../data/types";
import { TEXT_CHANNEL } from "../../../data/types";
import {
	historyDepth,
	historyPercent,
	historyRequest,
} from "../bridges/bridge-catalog";
import type { useAdminSpace } from "../space-admin";

type BridgeChanges = Parameters<BridgeData["update"]>[1];

const log = createLogger("bridge-links");

const IMPORT_STATES: readonly BridgeHistoryImport["state"][] = [
	"running",
	"done",
	"failed",
];

const sortLinks = (links: readonly BridgeLink[]) => {
	return [...links]
		.map(({ backfill: _backfill, ...rest }) => rest)
		.sort((a, b) => a.channel.localeCompare(b.channel));
};

const sameChannels = (a: readonly string[], b: readonly string[]) => {
	return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
};

const importState = (status: BridgeBackfillStatus | undefined) => {
	const state = status?.state as BridgeHistoryImport["state"] | undefined;

	return state && IMPORT_STATES.includes(state) ? state : "running";
};

const savedImport = (
	link: BridgeLink,
	statuses: readonly BridgeBackfillStatus[],
): BridgeHistoryImport | undefined => {
	const request = link.backfill;

	if (!request) return undefined;

	const status = statuses.find(
		(entry) =>
			entry.channel === link.channel &&
			entry.requestedAt === request.requestedAt,
	);

	return {
		depth: historyDepth(request),
		requestedAt: request.requestedAt,
		state: importState(status),
		imported: status?.imported ?? 0,
		progress: status ? historyPercent(status) : 0,
		...(status?.reached ? { reached: status.reached } : {}),
	};
};

export const createBridgeLinks = (
	admin: ReturnType<typeof useAdminSpace>,
	registrationId: () => string | undefined,
) => {
	const data = createMemo(() => {
		const community = admin.community();

		return community ? admin.data.directory.bridges(community.did) : undefined;
	});
	const registration = createMemo(() => {
		const id = registrationId();

		return id ? data()?.find(id) : undefined;
	});
	const [report] = createResource(
		() => {
			const id = registrationId();
			const current = data();

			if (!id || !current || !registration()) return undefined;

			return `${id}:${current.roomsVersion(id)}`;
		},
		() => {
			const id = registrationId();
			const current = data();

			if (!id || !current) return Promise.resolve({ rooms: [] });

			return current.rooms(id);
		},
	);
	const textChannels = createMemo(() => {
		const community = admin.community();

		if (!community) return [];

		return (
			admin.data
				.space(community)
				.channels.value()
				?.filter((channel) => channel.type === TEXT_CHANNEL) ?? []
		);
	});
	const [draftLinks, setDraftLinks] = createSignal<BridgeLink[]>();
	const [draftChannels, setDraftChannels] = createSignal<SpaceRef[]>();
	const [picks, setPicks] = createSignal<Record<string, BridgeHistoryDepth>>(
		{},
	);
	const [busy, setBusy] = createSignal(false);

	const savedLinks = () => registration()?.links ?? [];
	const links = () => draftLinks() ?? savedLinks();
	const savedChannels = () => (registration()?.channels ?? []) as SpaceRef[];
	const openChannels = () => draftChannels() ?? savedChannels();
	const installed = () => {
		const current = registration();

		return !!current && current.remoteSpace === current.community;
	};
	const failed = () => !!report.error;
	const latest = () => (failed() ? undefined : report.latest);
	const rooms = createMemo((): BridgeRoom[] =>
		(latest()?.rooms ?? []).map((room) => ({
			id: room.id,
			name: room.name,
			...(room.parent ? { parent: room.parent } : {}),
		})),
	);
	const loading = () => !failed() && latest() === undefined;
	const awaitingRooms = () => {
		const current = latest();

		return !installed() && !!current && !current.updatedAt;
	};

	const linkOf = (channel: string) => {
		return links().find((link) => link.channel === channel);
	};
	const roomOf = (channel: string) => {
		const link = linkOf(channel);

		if (link) return link.remoteRoom;

		return openChannels().includes(channel as SpaceRef)
			? BRIDGE_OPEN
			: BRIDGE_UNLINKED;
	};
	const pendingDepth = (channel: string) => {
		const depth = picks()[channel];

		return depth && depth !== "none" && linkOf(channel) ? depth : undefined;
	};

	const channels = createMemo((): BridgeLinkChannel[] => {
		const statuses = registration()?.backfills ?? [];

		return textChannels().map((channel) => {
			const link = linkOf(channel.space);
			const saved = link ? savedImport(link, statuses) : undefined;
			const history = picks()[channel.space];

			return {
				id: channel.space,
				name: channel.name,
				room: roomOf(channel.space),
				...(history ? { history } : {}),
				...(saved ? { saved } : {}),
			};
		});
	});

	const setRoom = (channel: string, roomId: string) => {
		const others = links().filter((link) => link.channel !== channel);
		const room = rooms().find((entry) => entry.id === roomId);
		const closed = openChannels().filter((entry) => entry !== channel);
		const kept =
			linkOf(channel)?.remoteRoom === roomId
				? linkOf(channel)
				: savedLinks().find(
						(link) => link.channel === channel && link.remoteRoom === roomId,
					);
		const next: BridgeLink | undefined =
			kept ??
			(room
				? {
						channel: channel as SpaceRef,
						remoteRoom: room.id,
						remoteName: room.name,
					}
				: undefined);

		if (linkOf(channel)?.remoteRoom !== roomId) {
			setPicks(({ [channel]: _dropped, ...rest }) => rest);
		}

		setDraftLinks(next ? [...others, next] : others);
		setDraftChannels(
			roomId === BRIDGE_OPEN ? [...closed, channel as SpaceRef] : closed,
		);
	};

	const setHistory = (channel: string, depth: BridgeHistoryDepth) => {
		setPicks((current) => ({ ...current, [channel]: depth }));
	};

	const edited = () => {
		return (
			links().some((link) => !!pendingDepth(link.channel)) ||
			JSON.stringify(sortLinks(links())) !==
				JSON.stringify(sortLinks(savedLinks())) ||
			!sameChannels(openChannels(), savedChannels())
		);
	};

	const reset = () => {
		setDraftLinks(undefined);
		setDraftChannels(undefined);
		setPicks({});
	};

	const run = async (changes: BridgeChanges) => {
		const id = registrationId();
		const current = data();

		if (!id || !current || busy()) return false;

		setBusy(true);

		try {
			await current.update(id, changes);

			return true;
		} catch (failure) {
			log.warn("could not update the bridge", {
				code: classifyThrown(failure).code,
			});
			toast.error("Couldn't update the bridge. Try again.");

			return false;
		} finally {
			setBusy(false);
		}
	};

	const saveLinks = async () => {
		const now = new Date();
		const requested = links().map((link) => {
			const depth = pendingDepth(link.channel);
			const backfill = depth ? historyRequest(depth, now) : undefined;

			return backfill ? { ...link, backfill } : link;
		});
		const saved = await run({ links: requested, channels: openChannels() });

		if (saved) {
			reset();
			toast.success("Links saved");
		}

		return saved;
	};

	return {
		data,
		registration,
		installed,
		channels,
		rooms,
		loading,
		failed,
		awaitingRooms,
		setRoom,
		setHistory,
		edited,
		busy,
		run,
		saveLinks,
		reset,
	};
};

type BridgeLinksModel = ReturnType<typeof createBridgeLinks>;

export const ROOMS_FAILED =
	"Couldn't load the bridge's rooms. Try again later.";

export const installedIntro = (links: BridgeLinksModel) => {
	if (!links.installed()) return undefined;

	return `Pick the channels ${links.registration()?.remoteSpaceName ?? "this bridge"} can read and post in. Then set the bridge up from inside those channels, following its own instructions.`;
};
