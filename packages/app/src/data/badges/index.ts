import {
	BOT_BADGE_DEFINITION,
	FALLBACK_BADGE_DEFINITIONS,
} from "@colibri-social/ui";
import { readStoredJSON, writeStoredJSON } from "../persist";
import type { DataSource } from "../source";
import { useData } from "../store";
import { emptyLabeler } from "./labeler";
import { parseDefinitions } from "./parse";
import {
	type BadgeStore,
	createBadgeStore,
	type DefinitionSnapshot,
} from "./store";

export type { LabelerTransport } from "./labeler";
export type { BadgeProfile, BadgeStore } from "./store";

const SNAPSHOT_KEY = "colibri:badge-definitions:v1";

const isSnapshot = (value: unknown): value is DefinitionSnapshot =>
	typeof value === "object" &&
	value !== null &&
	Array.isArray((value as DefinitionSnapshot).definitions) &&
	typeof (value as DefinitionSnapshot).ts === "number";

const stores = new WeakMap<DataSource, BadgeStore>();

export const badgeStoreFor = (source: DataSource): BadgeStore => {
	const existing = stores.get(source);
	if (existing) return existing;
	const transport = source.labeler ?? emptyLabeler;
	const persisted = transport !== emptyLabeler;
	const store = createBadgeStore({
		transport,
		fallbacks: FALLBACK_BADGE_DEFINITIONS,
		bot: BOT_BADGE_DEFINITION,
		readSnapshot: persisted
			? () => {
					const stored = readStoredJSON(SNAPSHOT_KEY, isSnapshot);
					if (!stored) return undefined;
					return {
						ts: stored.ts,
						definitions: parseDefinitions({
							badgeDefinitions: stored.definitions,
						}),
					};
				}
			: undefined,
		writeSnapshot: persisted
			? (snapshot) => writeStoredJSON(SNAPSHOT_KEY, snapshot)
			: undefined,
	});
	stores.set(source, store);
	return store;
};

export const useBadges = () => badgeStoreFor(useData().source);
