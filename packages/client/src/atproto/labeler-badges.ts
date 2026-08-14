import { classifyResponse, classifyThrown } from "../errors/classify";
import { getLabelerDid } from "../utils/labeler";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import type { BadgeAppearance, BadgeDefinition } from "./cache/schema";
import {
	cacheEnabled,
	readLabelerBadgeDefinitions,
	writeLabelerBadgeDefinitions,
} from "./cache/store";
import { resolvePdsHost } from "./resolve-pds";

const log = createLogger("badges");

export type { BadgeAppearance, BadgeDefinition } from "./cache/schema";

const METHOD = "com.atproto.repo.getRecord";
const COLLECTION = "social.colibri.labeler.service";

const DEFINITIONS_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_DEFINITIONS = 100;
const MAX_COLORS = 6;

const HEX_COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const VARIANTS = new Set<BadgeAppearance["variant"]>([
	"solid",
	"gradientBorder",
]);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const asColor = (value: unknown): string | undefined =>
	typeof value === "string" && HEX_COLOR.test(value) ? value : undefined;

const parseAppearance = (value: unknown): BadgeAppearance | undefined => {
	const raw = asRecord(value);
	if (!raw) return undefined;

	const variant = raw.variant ?? "solid";
	if (typeof variant !== "string") return undefined;
	if (!VARIANTS.has(variant as BadgeAppearance["variant"])) return undefined;

	const foreground = asColor(raw.foreground);
	if (!foreground) return undefined;

	if (!Array.isArray(raw.colors)) return undefined;
	const colors: Array<string> = [];
	for (const entry of raw.colors.slice(0, MAX_COLORS)) {
		const color = asColor(entry);
		if (!color) return undefined;
		colors.push(color);
	}
	if (colors.length === 0) return undefined;

	return {
		variant: variant as BadgeAppearance["variant"],
		colors,
		foreground,
	};
};

const parseDefinition = (value: unknown): BadgeDefinition | undefined => {
	const raw = asRecord(value);
	if (!raw) return undefined;

	const { identifier, name, description, precedence } = raw;
	if (typeof identifier !== "string" || identifier.length === 0) {
		return undefined;
	}
	if (typeof name !== "string" || name.length === 0) return undefined;
	if (typeof description !== "string") return undefined;

	return {
		identifier,
		name,
		description,
		...(typeof precedence === "number" && Number.isFinite(precedence)
			? { precedence }
			: {}),
		...(raw.appearance === undefined
			? {}
			: { appearance: parseAppearance(raw.appearance) }),
	};
};

const parseDefinitions = (value: unknown): Array<BadgeDefinition> => {
	const record = asRecord(value);
	const raw = record?.badgeDefinitions;
	if (!Array.isArray(raw)) return [];

	const out: Array<BadgeDefinition> = [];
	for (const entry of raw.slice(0, MAX_DEFINITIONS)) {
		const definition = parseDefinition(entry);
		if (definition) out.push(definition);
	}
	return out;
};

const fetchDefinitions = async (
	did: string,
): Promise<Array<BadgeDefinition>> => {
	const host = await resolvePdsHost(did);
	if (!host) {
		log.warn("the labeler has no resolvable PDS, keeping bundled badges", {
			did,
		});
		return [];
	}

	const params = new URLSearchParams({
		repo: did,
		collection: COLLECTION,
		rkey: "self",
	});

	const start = perfNow();
	const res = await fetch(`https://${host}/xrpc/${METHOD}?${params}`, {
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	recordRequest(METHOD, start, perfNow() - start, res.ok);

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw classifyResponse({
			status: res.status,
			body,
			method: METHOD,
			retryAfter: res.headers.get("retry-after"),
		});
	}

	const body = (await res.json()) as { value?: unknown };
	return parseDefinitions(body.value);
};

let cache: { did: string; definitions: Array<BadgeDefinition> } | undefined;
let expiresAt = 0;
let inflight: Promise<Array<BadgeDefinition>> | undefined;

export const getLabelerBadgeDefinitions = (): Promise<
	Array<BadgeDefinition>
> => {
	const did = getLabelerDid();

	if (cache?.did === did && expiresAt > Date.now()) {
		return Promise.resolve(cache.definitions);
	}

	if (inflight) return inflight;

	const promise = (async () => {
		if (cacheEnabled()) {
			const snap = await readLabelerBadgeDefinitions(did);
			if (snap && Date.now() - snap.ts < DEFINITIONS_TTL_MS) {
				cache = { did, definitions: snap.definitions };
				expiresAt = snap.ts + DEFINITIONS_TTL_MS;
				return snap.definitions;
			}
		}

		let definitions: Array<BadgeDefinition>;
		try {
			definitions = await fetchDefinitions(did);
		} catch (err) {
			log.warn("fetching the badge catalogue failed", {
				code: classifyThrown(err, { method: METHOD }).code,
			});
			cache = { did, definitions: [] };
			expiresAt = Date.now() + FAILURE_TTL_MS;
			return [];
		}

		cache = { did, definitions };
		expiresAt =
			Date.now() +
			(definitions.length === 0 ? FAILURE_TTL_MS : DEFINITIONS_TTL_MS);
		if (definitions.length > 0) {
			void writeLabelerBadgeDefinitions(did, {
				definitions,
				ts: Date.now(),
			});
		}
		return definitions;
	})().finally(() => {
		inflight = undefined;
	});

	inflight = promise;
	return promise;
};
