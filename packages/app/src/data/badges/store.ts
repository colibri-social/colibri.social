import { classifyThrown, createLogger } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import {
	DEFINITIONS_METHOD,
	type LabelerTransport,
	MAX_DIDS_PER_QUERY,
	QUERY_LABELS_METHOD,
} from "./labeler";
import {
	type BadgeDefinition,
	type BadgeSubject,
	BOT_BADGE,
	definitionFor,
	groupByUri,
	indexDefinitions,
	primaryBadge,
	resolveActiveLabels,
	sortBadges,
} from "./parse";

const log = createLogger("badges");

export const LABELS_TTL_MS = 15 * 60 * 1000;
export const FAILURE_TTL_MS = 30_000;
export const TRUNCATED_TTL_MS = 60_000;
export const DEFINITIONS_TTL_MS = 60 * 60 * 1000;
export const FLUSH_WINDOW_MS = 48;
export const MAX_FLUSH_DELAY_MS = 150;

export type DefinitionSnapshot = { definitions: BadgeDefinition[]; ts: number };

export type BadgeStoreOptions = {
	transport: LabelerTransport;
	fallbacks: readonly BadgeDefinition[];
	bot: BadgeDefinition;
	now?: () => number;
	readSnapshot?: () => DefinitionSnapshot | undefined;
	writeSnapshot?: (snapshot: DefinitionSnapshot) => void;
};

export type BadgeProfile = BadgeSubject & { did: string };

type Entry = { values: string[]; expiresAt: number };

export const createBadgeStore = (options: BadgeStoreOptions) => {
	const now = options.now ?? Date.now;
	const index = (published: readonly BadgeDefinition[]) =>
		indexDefinitions(
			published.length > 0 ? published : options.fallbacks,
			options.fallbacks,
			options.bot,
		);

	const snapshot = options.readSnapshot?.();
	const [definitions, setDefinitions] = createSignal(
		index(snapshot?.definitions ?? []),
	);
	const [version, setVersion] = createSignal(0);
	const entries = new Map<string, Entry>();
	const queued = new Set<string>();
	let pending: string[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;
	let firstQueuedAt: number | undefined;
	let definitionsLoad: Promise<void> | undefined;

	if (snapshot && now() - snapshot.ts < DEFINITIONS_TTL_MS) {
		definitionsLoad = Promise.resolve();
	}

	const ensureDefinitions = () => {
		definitionsLoad ??= options.transport
			.definitions()
			.then((published) => {
				if (published.length === 0) return;
				setDefinitions(index(published));
				options.writeSnapshot?.({ definitions: published, ts: now() });
			})
			.catch((error: unknown) => {
				log.warn("could not load the badge list, using the built-in one", {
					code: classifyThrown(error, { method: DEFINITIONS_METHOD }).code,
				});
			});
		return definitionsLoad;
	};

	const settle = (did: string, values: string[], ttl: number) => {
		entries.set(did, { values, expiresAt: now() + ttl });
		queued.delete(did);
	};

	const queryChunk = async (chunk: string[]) => {
		try {
			const { labels, truncated } = await options.transport.queryLabels(chunk);
			const byUri = groupByUri(labels);
			for (const did of chunk) {
				const active = resolveActiveLabels(byUri.get(did) ?? [], now());
				settle(
					did,
					active.map((label) => label.val),
					truncated ? TRUNCATED_TTL_MS : LABELS_TTL_MS,
				);
			}
			if (truncated) {
				log.warn("the badge lookup hit its page limit", {
					size: chunk.length,
				});
			}
		} catch (error) {
			log.warn("could not load badges", {
				size: chunk.length,
				code: classifyThrown(error, { method: QUERY_LABELS_METHOD }).code,
			});
			for (const did of chunk) {
				settle(did, entries.get(did)?.values ?? [], FAILURE_TTL_MS);
			}
		}
	};

	const flush = async () => {
		const dids = pending;
		pending = [];
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		firstQueuedAt = undefined;
		const chunks: string[][] = [];
		for (let start = 0; start < dids.length; start += MAX_DIDS_PER_QUERY) {
			chunks.push(dids.slice(start, start + MAX_DIDS_PER_QUERY));
		}
		await Promise.all(chunks.map(queryChunk));
		setVersion((value) => value + 1);
	};

	const schedule = () => {
		if (timer !== undefined) clearTimeout(timer);
		if (pending.length >= MAX_DIDS_PER_QUERY) {
			void flush();
			return;
		}
		firstQueuedAt ??= now();
		const budget = Math.max(0, firstQueuedAt + MAX_FLUSH_DELAY_MS - now());
		timer = setTimeout(() => void flush(), Math.min(FLUSH_WINDOW_MS, budget));
	};

	const request = (did: string) => {
		if (queued.has(did)) return;
		const entry = entries.get(did);
		if (entry && entry.expiresAt > now()) return;
		queued.add(did);
		pending.push(did);
		schedule();
	};

	const valuesOf = (profile: BadgeProfile) => {
		version();
		void ensureDefinitions();
		request(profile.did);
		return sortBadges(
			definitions(),
			entries.get(profile.did)?.values ?? [],
			profile,
		);
	};

	const all = (profile: BadgeProfile): BadgeDefinition[] =>
		valuesOf(profile).map((val) => definitionFor(definitions(), val));

	const primary = (
		profile: BadgeProfile,
		options: { withoutBot?: boolean } = {},
	): BadgeDefinition | undefined => {
		const sorted = valuesOf(profile).filter(
			(val) => !options.withoutBot || val !== BOT_BADGE,
		);
		const val = primaryBadge(sorted, profile.preferredBadge);
		return val ? definitionFor(definitions(), val) : undefined;
	};

	const invalidate = (did: string) => {
		entries.delete(did);
		setVersion((value) => value + 1);
	};

	return {
		all,
		primary,
		invalidate,
		ensureDefinitions,
		definitions,
		flush: () => (pending.length === 0 ? Promise.resolve() : flush()),
	};
};

export type BadgeStore = ReturnType<typeof createBadgeStore>;
