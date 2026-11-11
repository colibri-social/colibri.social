import { classifyThrown, createLogger } from "@colibri-social/lib";
import { type Accessor, createSignal } from "solid-js";

const log = createLogger("nodes");

export const LIST_NODES_PATH = "/xrpc/social.colibri.beta.server.listNodes";

export const PROBE_TIMEOUT_MS = 3_000;

export const PROBE_ROUNDS = 2;

export const REFRESH_AFTER_MS = 10 * 60_000;

export const STORAGE_KEY = "colibri.nodes.v1";

export type NodeRole = "main" | "failover" | "api" | "live" | "voice";

export type NetworkNode = {
	id: string;
	region: string;
	roles: string[];
	endpoint: string;
	probeUrl: string;
	rttMs: number | null;
};

export type NodeStorage = Pick<Storage, "getItem" | "setItem">;

export type NodeDirectoryOptions = {
	mainUrl: string;
	fetch?: typeof fetch;
	now?: () => number;
	storage?: NodeStorage | null;
};

export type NodeDirectory = {
	nodes: Accessor<readonly NetworkNode[]>;
	refresh: () => Promise<void>;
	refreshIfStale: () => Promise<void>;
	endpointFor: (role: NodeRole, avoid?: ReadonlySet<string>) => string | null;
	nodeAt: (endpoint: string) => NetworkNode | undefined;
};

type Stored = {
	at: number;
	main: string;
	nodes: NetworkNode[];
};

const originOf = (url: string): string => {
	return new URL(url).origin;
};

const browserStorage = (): NodeStorage | null => {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
};

const parseNodes = (body: unknown): Omit<NetworkNode, "rttMs">[] => {
	const list = (body as { nodes?: unknown } | null)?.nodes;

	if (!Array.isArray(list)) {
		return [];
	}

	return list.flatMap((entry) => {
		const node = entry as Record<string, unknown>;

		if (
			typeof node.id !== "string" ||
			typeof node.endpoint !== "string" ||
			typeof node.probeUrl !== "string" ||
			!Array.isArray(node.roles)
		) {
			return [];
		}

		try {
			return [
				{
					id: node.id,
					region: typeof node.region === "string" ? node.region : "",
					roles: node.roles.filter(
						(role): role is string => typeof role === "string",
					),
					endpoint: originOf(node.endpoint),
					probeUrl: new URL(node.probeUrl).toString(),
				},
			];
		} catch {
			return [];
		}
	});
};

export const byLatency = (nodes: readonly NetworkNode[]): NetworkNode[] => {
	return [...nodes].sort(
		(a, b) =>
			(a.rttMs ?? Number.POSITIVE_INFINITY) -
				(b.rttMs ?? Number.POSITIVE_INFINITY) || a.id.localeCompare(b.id),
	);
};

export const createNodeDirectory = (
	options: NodeDirectoryOptions,
): NodeDirectory => {
	const request = options.fetch ?? fetch;
	const now = options.now ?? Date.now;
	const storage =
		options.storage === undefined ? browserStorage() : options.storage;
	const main = originOf(options.mainUrl);

	const load = (): Stored | null => {
		try {
			const raw = storage?.getItem(STORAGE_KEY);
			const parsed = raw ? (JSON.parse(raw) as Stored) : null;

			return parsed && parsed.main === main && Array.isArray(parsed.nodes)
				? parsed
				: null;
		} catch {
			return null;
		}
	};

	const stored = load();
	const [nodes, setNodes] = createSignal<readonly NetworkNode[]>(
		stored?.nodes ?? [],
	);
	let refreshedAt = stored?.at ?? 0;
	let refreshing: Promise<void> | null = null;

	const probe = async (url: string): Promise<number | null> => {
		let best: number | null = null;

		for (let round = 0; round < PROBE_ROUNDS; round += 1) {
			const started = now();

			try {
				const response = await request(url, {
					cache: "no-store",
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
				});

				if (!response.ok) return null;

				const elapsed = now() - started;

				best = best === null ? elapsed : Math.min(best, elapsed);
			} catch {
				return null;
			}
		}

		return best;
	};

	const refresh = (): Promise<void> => {
		refreshing ??= (async () => {
			try {
				const response = await request(new URL(LIST_NODES_PATH, main), {
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS * 2),
				});

				if (!response.ok) {
					setNodes([]);
					refreshedAt = now();

					return;
				}

				const listed = parseNodes(await response.json());
				const measured: NetworkNode[] = [];

				for (const node of listed) {
					measured.push({ ...node, rttMs: await probe(node.probeUrl) });
				}

				const reachable = byLatency(
					measured.filter((node) => node.rttMs !== null),
				);

				setNodes(reachable);
				refreshedAt = now();

				try {
					storage?.setItem(
						STORAGE_KEY,
						JSON.stringify({
							at: refreshedAt,
							main,
							nodes: reachable,
						} satisfies Stored),
					);
				} catch {}

				log.info("measured nodes", {
					nodes: reachable.map((node) => `${node.id}:${node.rttMs}`).join(","),
				});
			} catch (err) {
				log.warn("couldn't list the nodes", { code: classifyThrown(err).code });
			} finally {
				refreshing = null;
			}
		})();

		return refreshing;
	};

	return {
		nodes,
		refresh,
		refreshIfStale: () => {
			return now() - refreshedAt >= REFRESH_AFTER_MS
				? refresh()
				: Promise.resolve();
		},
		endpointFor: (role, avoid) => {
			const pick = nodes().find(
				(node) => node.roles.includes(role) && !avoid?.has(node.endpoint),
			);

			return pick?.endpoint ?? null;
		},
		nodeAt: (endpoint) => {
			const origin = originOf(endpoint);

			return nodes().find((node) => node.endpoint === origin);
		},
	};
};
