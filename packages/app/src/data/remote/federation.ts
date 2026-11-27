import { COLLECTIONS, SELF } from "@colibri-social/lexicons";
import { classifyThrown, colibri, createLogger } from "@colibri-social/lib";
import { readStored, writeStored } from "../persist";
import type { HostModeSignal } from "../polyfill/host-mode";
import { createPreferencesGrant } from "../preferences/grant";
import { isMissingSpace, type PreferencesSpace } from "../preferences/remote";
import type { CommunityView } from "../types";
import type { Records } from "./records";
import type { Transport } from "./transport";

const log = createLogger("federation");

export const APPVIEW_COLLECTION = COLLECTIONS.appview;
export const REMOTE_SPACE_COLLECTION = COLLECTIONS.remoteSpace;
export const MAX_DECLARED_APPVIEWS = 8;
export const DECLARE_CHECK_MS = 24 * 60 * 60_000;
const FEDERATION_STORAGE_PREFIX = "colibri.federation.";

type DeclaredRecord = { value?: { appviews?: unknown } };

type Remote = { did: string; managingApp?: string };

export type FederationStorage = {
	read: (key: string) => string | undefined;
	write: (key: string, value: string) => void;
};

const browserStorage: FederationStorage = {
	read: readStored,
	write: writeStored,
};

export const clearFederationCache = (
	storage:
		| Pick<Storage, "length" | "key" | "removeItem">
		| undefined = typeof localStorage === "undefined"
		? undefined
		: localStorage,
) => {
	if (!storage) return;

	try {
		const keys: string[] = [];

		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index);

			if (key?.startsWith(FEDERATION_STORAGE_PREFIX)) keys.push(key);
		}

		for (const key of keys) storage.removeItem(key);
	} catch {}
};

export const declaredWith = (current: unknown, appView: string): string[] => {
	const listed = Array.isArray(current)
		? current.filter(
				(entry): entry is string =>
					typeof entry === "string" && entry !== appView,
			)
		: [];

	return [...listed, appView].slice(-MAX_DECLARED_APPVIEWS);
};

const preferencesAccessOf = (view: CommunityView): number | undefined => {
	const until = Date.parse(view.viewer?.preferencesAccessUntil ?? "");

	return Number.isFinite(until) ? until : undefined;
};

const isMemberOrPending = (view: CommunityView): boolean => {
	return Boolean(view.viewer?.isMember || view.viewer?.applicationPending);
};

export const createFederation = (input: {
	transport: Transport;
	records: Records;
	space: PreferencesSpace;
	host?: HostModeSignal;
	storage?: FederationStorage;
}) => {
	const { transport, records, space, host } = input;
	const storage = input.storage ?? browserStorage;
	const self = transport.appViewDid;
	const declaredKey = `${FEDERATION_STORAGE_PREFIX}declared.v1:${transport.did}:${self}`;
	const remote = new Map<string, string>();
	const recorded = new Map<string, string>();
	let listing: Promise<boolean> | undefined;
	const grants = new Map<string, { community: string; stop: () => void }>();
	const grantedNow = new Set<string>();
	const rechecked = new Set<string>();
	const joinedAt = new Map<string, number>();
	const forgottenAt = new Map<string, number>();
	let joins = 0;
	let forgets = 0;
	let started = false;

	const isRemote = (view: Remote): view is Required<Remote> => {
		return Boolean(view.managingApp && view.managingApp !== self);
	};

	const target = (community: string) => {
		return {
			space: space.space,
			collection: REMOTE_SPACE_COLLECTION,
			rkey: community,
		};
	};

	const grantKey = (managingApp: string) => {
		return `${FEDERATION_STORAGE_PREFIX}grant.v1:${transport.did}:${managingApp}`;
	};

	const startGrant = (managingApp: string, community: string) => {
		const key = grantKey(managingApp);

		const grant = createPreferencesGrant({
			transport,
			space,
			host,
			community,
			memory: {
				read: () => storage.read(key),
				write: (expiresAt) => {
					grantedNow.add(managingApp);
					storage.write(key, expiresAt);
				},
			},
		});

		grants.set(managingApp, { community, stop: grant.start() });
	};

	const syncGrants = () => {
		const wanted = new Map<string, string>();

		for (const [community, managingApp] of remote) {
			if (!wanted.has(managingApp)) wanted.set(managingApp, community);
		}

		for (const [managingApp, running] of grants) {
			if (wanted.has(managingApp)) continue;

			running.stop();
			grants.delete(managingApp);
		}

		if (!started) return;

		for (const [managingApp, community] of wanted) {
			if (!grants.has(managingApp)) startGrant(managingApp, community);
		}
	};

	const declaredRecently = () => {
		const checkedAt = Number(storage.read(declaredKey));

		return Date.now() - checkedAt < DECLARE_CHECK_MS;
	};

	const declare = async () => {
		if (declaredRecently()) return;

		try {
			const current = (await records.getInRepo(APPVIEW_COLLECTION, SELF)) as
				| DeclaredRecord
				| undefined;
			const listed = current?.value?.appviews;

			if (!Array.isArray(listed) || !listed.includes(self)) {
				await records.putInRepo(APPVIEW_COLLECTION, SELF, {
					$type: APPVIEW_COLLECTION,
					appviews: declaredWith(listed, self),
					updatedAt: new Date().toISOString(),
				});
			}

			storage.write(declaredKey, String(Date.now()));
		} catch (error) {
			log.warn("could not declare this AppView", {
				code: classifyThrown(error).code,
			});
		}
	};

	const loadRecorded = () => {
		listing ??= records
			.listInSpace({ space: space.space, collection: REMOTE_SPACE_COLLECTION })
			.then((found) => {
				for (const record of found) {
					const app = (record.value as { managingApp?: unknown }).managingApp;

					if (typeof app === "string") recorded.set(record.rkey, app);
				}

				return true;
			})
			.catch((error: unknown) => {
				if (isMissingSpace(error)) return true;

				listing = undefined;
				log.warn("could not list the joined Space records", {
					code: classifyThrown(error).code,
				});

				return false;
			});

		return listing;
	};

	const remember = async (community: string, managingApp: string) => {
		if (recorded.get(community) === managingApp) return;

		await space.write(() =>
			records.putInSpace(target(community), {
				$type: REMOTE_SPACE_COLLECTION,
				managingApp,
				joinedAt: new Date().toISOString(),
			}),
		);

		recorded.set(community, managingApp);
	};

	const backfill = async (views: readonly CommunityView[]) => {
		const since = forgets;

		if (!(await loadRecorded())) return;

		for (const view of views) {
			if (view.viewer?.isMember !== true) continue;

			const app = view.managingApp ?? self;

			if (recorded.get(view.did) === app) continue;

			if ((forgottenAt.get(view.did) ?? 0) > since) continue;

			try {
				await remember(view.did, app);
			} catch (error) {
				log.warn("could not record a joined Space", {
					code: classifyThrown(error).code,
				});

				return;
			}
		}
	};

	const forget = async (community: string) => {
		const wasRemote = remote.delete(community);

		forgets += 1;
		forgottenAt.set(community, forgets);
		joinedAt.delete(community);

		if (wasRemote) syncGrants();

		if (!wasRemote && listing && (await listing) && !recorded.has(community)) {
			return;
		}

		recorded.delete(community);

		try {
			await records.deleteInSpace(target(community));
		} catch (error) {
			log.warn("could not delete a joined Space record", {
				code: classifyThrown(error).code,
			});
		}
	};

	const joined = async (community: string) => {
		try {
			const view = (
				await transport.query(colibri.community.getCommunity.main, {
					params: { community },
				})
			).community as CommunityView;

			await remember(community, view.managingApp ?? self);

			if (!isRemote(view)) return;

			joins += 1;
			joinedAt.set(community, joins);
			remote.set(community, view.managingApp);
			syncGrants();
		} catch (error) {
			log.warn("could not remember a joined Space", {
				code: classifyThrown(error).code,
			});
		}
	};

	const noteAccess = (view: Required<Remote> & CommunityView) => {
		const app = view.managingApp;
		const until = preferencesAccessOf(view);
		const remembered = Date.parse(storage.read(grantKey(app)) ?? "");

		if (until !== undefined) {
			if (!(until <= remembered)) {
				storage.write(grantKey(app), new Date(until).toISOString());
			}

			return;
		}

		if (grantedNow.has(app) || rechecked.has(app)) return;

		rechecked.add(app);
		storage.write(grantKey(app), "");

		const running = grants.get(app);

		if (!running) return;

		running.stop();
		grants.delete(app);
	};

	const mark = () => {
		return joins;
	};

	const reconcile = (
		views: CommunityView[],
		unavailable: readonly Required<Remote>[] = [],
		since = joins,
	): CommunityView[] => {
		const fresh = [...remote].filter(
			([community]) => (joinedAt.get(community) ?? 0) > since,
		);

		remote.clear();

		for (const [community, managingApp] of fresh) {
			remote.set(community, managingApp);
		}

		const kept = views.filter((view) => {
			if (!isRemote(view)) return true;

			if (isMemberOrPending(view)) {
				remote.set(view.did, view.managingApp);
				noteAccess(view);

				return view.viewer?.isMember === true;
			}

			remote.set(view.did, view.managingApp);
			void forget(view.did);

			return false;
		});

		for (const entry of unavailable) remote.set(entry.did, entry.managingApp);

		syncGrants();
		void backfill(kept);

		return kept;
	};

	const start = () => {
		started = true;
		void declare();
		syncGrants();

		return () => {
			started = false;

			for (const running of grants.values()) running.stop();

			grants.clear();
		};
	};

	return { declare, joined, forget, mark, reconcile, start };
};
