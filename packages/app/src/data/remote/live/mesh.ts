import {
	type ClientFrame,
	createLogger,
	spaceAuthority,
	viewChannelFrame,
} from "@colibri-social/lib";
import { createSignal } from "solid-js";
import type { LiveEvent } from "../../source";
import type { LiveConnection } from "./connection";
import type { SubscriptionSets, SubscriptionTarget } from "./ledger";

const log = createLogger("live");

const FRAME_PREFIX = "social.colibri.beta.sync.defs#";

export type LiveMeshOptions = {
	home: LiveConnection;
	homeApp: string;
	connect: (managingApp: string) => LiveConnection | undefined;
};

export type LiveMesh = LiveConnection & {
	assign: (routes: ReadonlyMap<string, string>) => void;
	managingApp: (community: string | undefined) => string;
};

type Remote = {
	connection: LiveConnection;
	pieces: number;
	stop: () => void;
};

type Watch = {
	target: SubscriptionTarget;
	releases: (() => void)[];
};

const frameName = (frame: ClientFrame): string => {
	return ((frame as { $type?: string }).$type ?? "").slice(FRAME_PREFIX.length);
};

const frameSpace = (frame: ClientFrame): string | undefined => {
	const { channel, space } = frame as { channel?: unknown; space?: unknown };
	const ref = typeof channel === "string" ? channel : space;

	return typeof ref === "string" ? spaceAuthority(ref) : undefined;
};

const union = (sets: readonly SubscriptionSets[]): SubscriptionSets => {
	return {
		communities: new Set(sets.flatMap((set) => [...set.communities])),
		channels: new Set(sets.flatMap((set) => [...set.channels])),
	};
};

export const createLiveMesh = (options: LiveMeshOptions): LiveMesh => {
	const { home, homeApp } = options;
	const listeners = new Set<(event: LiveEvent) => void>();
	const remotes = new Map<string, Remote>();
	const watches = new Set<Watch>();
	const lastEpoch = new Map<LiveConnection, number>();
	const [connections, setConnections] = createSignal<LiveConnection[]>([home]);
	let routes: ReadonlyMap<string, string> = new Map();
	let retired = 0;
	let viewingOn: LiveConnection | undefined;
	let closed = false;

	const dispatch = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};

	home.subscribe(dispatch);

	const appFor = (community: string | undefined): string => {
		const app = community ? routes.get(community) : undefined;

		return app && app !== homeApp ? app : homeApp;
	};

	const publish = () => {
		setConnections([
			home,
			...[...remotes.values()].map((remote) => remote.connection),
		]);
	};

	const open = (app: string): Remote | undefined => {
		const existing = remotes.get(app);

		if (existing || closed) return existing;

		const connection = options.connect(app);

		if (!connection) return undefined;

		const remote = {
			connection,
			pieces: 0,
			stop: connection.subscribe(dispatch),
		};

		remotes.set(app, remote);
		publish();
		log.info("opened a live socket to another server", { app });

		return remote;
	};

	const retire = (app: string) => {
		const remote = remotes.get(app);

		if (!remote) return;

		remotes.delete(app);
		retired += lastEpoch.get(remote.connection) ?? 0;
		lastEpoch.delete(remote.connection);

		if (viewingOn === remote.connection) viewingOn = undefined;

		remote.stop();
		remote.connection.close();
		publish();
	};

	const connectionFor = (community: string | undefined): LiveConnection => {
		const app = appFor(community);

		if (app === homeApp) return home;

		return remotes.get(app)?.connection ?? open(app)?.connection ?? home;
	};

	const place = (watch: Watch) => {
		const groups = new Map<string, Required<SubscriptionTarget>>();

		const group = (app: string) => {
			const existing = groups.get(app);

			if (existing) return existing;

			const created = { communities: [], channels: [] } as {
				communities: string[];
				channels: string[];
			};

			groups.set(app, created);

			return created;
		};

		for (const community of watch.target.communities ?? []) {
			(group(appFor(community)).communities as string[]).push(community);
		}

		for (const channel of watch.target.channels ?? []) {
			const app = appFor(spaceAuthority(channel));

			(group(app).channels as string[]).push(channel);
		}

		const releases: (() => void)[] = [];

		for (const [app, target] of groups) {
			if (app === homeApp) {
				releases.push(home.watch(target));
				continue;
			}

			const remote = open(app);

			if (!remote) {
				releases.push(home.watch(target));
				continue;
			}

			remote.pieces += 1;

			const release = remote.connection.watch(target);

			releases.push(() => {
				release();
				remote.pieces -= 1;

				if (remote.pieces === 0 && remotes.get(app) === remote) retire(app);
			});
		}

		return releases;
	};

	const send = (frame: ClientFrame): boolean => {
		const name = frameName(frame);

		if (name === "activity" || name === "setPresence") {
			const sent = home.send(frame);

			for (const remote of remotes.values()) remote.connection.send(frame);

			return sent;
		}

		if (name === "viewChannel") {
			const target = connectionFor(frameSpace(frame));

			if (viewingOn && viewingOn !== target) viewingOn.send(viewChannelFrame());

			viewingOn = frameSpace(frame) ? target : undefined;

			return target.send(frame);
		}

		return connectionFor(frameSpace(frame)).send(frame);
	};

	const epoch = (): number | undefined => {
		const current = home.epoch();

		if (current === undefined) return undefined;

		let total = retired + current;

		for (const connection of connections()) {
			if (connection === home) continue;

			const seen = connection.epoch();

			if (seen !== undefined) lastEpoch.set(connection, seen);

			total += lastEpoch.get(connection) ?? 0;
		}

		return total;
	};

	return {
		...home,
		subscribe: (listener) => {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
		send,
		epoch,
		watch: (target) => {
			const watch: Watch = { target, releases: [] };

			watch.releases = place(watch);
			watches.add(watch);

			let released = false;

			return () => {
				if (released) return;

				released = true;
				watches.delete(watch);

				for (const release of watch.releases) release();
			};
		},
		granted: () => {
			return union(connections().map((connection) => connection.granted()));
		},
		denied: () => {
			return union(connections().map((connection) => connection.denied()));
		},
		retry: () => {
			for (const connection of connections()) connection.retry();
		},
		close: () => {
			if (closed) return;

			closed = true;

			for (const app of [...remotes.keys()]) retire(app);

			listeners.clear();
			home.close();
		},
		managingApp: appFor,
		assign: (next) => {
			const changed =
				next.size !== routes.size ||
				[...next].some(([community, app]) => routes.get(community) !== app);

			if (!changed) return;

			routes = new Map(next);

			for (const watch of watches) {
				const previous = watch.releases;

				watch.releases = place(watch);

				for (const release of previous) release();
			}
		},
	};
};
