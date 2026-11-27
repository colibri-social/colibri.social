import { SELF } from "@colibri-social/lexicons";
import { classifyThrown, colibri, createLogger } from "@colibri-social/lib";
import type { HostModeSignal } from "../polyfill/host-mode";
import { createPreferencesGrant } from "../preferences/grant";
import type { PreferencesSpace } from "../preferences/remote";
import type { CommunityView } from "../types";
import type { Records } from "./records";
import type { Transport } from "./transport";

const log = createLogger("federation");

export const APPVIEW_COLLECTION = "social.colibri.beta.actor.appview";
export const REMOTE_SPACE_COLLECTION = "social.colibri.beta.actor.remoteSpace";
export const MAX_DECLARED_APPVIEWS = 8;

type DeclaredRecord = { value?: { appviews?: unknown } };

type Remote = { did: string; managingApp?: string };

export const declaredWith = (current: unknown, appView: string): string[] => {
	const listed = Array.isArray(current)
		? current.filter(
				(entry): entry is string =>
					typeof entry === "string" && entry !== appView,
			)
		: [];

	return [...listed, appView].slice(-MAX_DECLARED_APPVIEWS);
};

export const isMemberOrPending = (view: CommunityView): boolean => {
	return Boolean(view.viewer?.isMember || view.viewer?.applicationPending);
};

export const createFederation = (input: {
	transport: Transport;
	records: Records;
	space: PreferencesSpace;
	host?: HostModeSignal;
}) => {
	const { transport, records, space, host } = input;
	const self = transport.appViewDid;
	const remote = new Map<string, string>();
	const grants = new Map<string, { community: string; stop: () => void }>();
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

	const startGrant = (managingApp: string, community: string) => {
		const grant = createPreferencesGrant({ transport, space, host, community });

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

	const declare = async () => {
		try {
			const current = (await records.getInRepo(APPVIEW_COLLECTION, SELF)) as
				| DeclaredRecord
				| undefined;
			const listed = current?.value?.appviews;

			if (Array.isArray(listed) && listed.includes(self)) return;

			await records.putInRepo(APPVIEW_COLLECTION, SELF, {
				$type: APPVIEW_COLLECTION,
				appviews: declaredWith(listed, self),
				updatedAt: new Date().toISOString(),
			});
		} catch (error) {
			log.warn("could not declare this AppView", {
				code: classifyThrown(error).code,
			});
		}
	};

	const forget = async (community: string) => {
		if (!remote.delete(community)) return;

		syncGrants();

		try {
			await records.deleteInSpace(target(community));
		} catch (error) {
			log.warn("could not delete a remote Space record", {
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

			if (!isRemote(view)) return;

			await space.write(() =>
				records.putInSpace(target(community), {
					$type: REMOTE_SPACE_COLLECTION,
					managingApp: view.managingApp,
					joinedAt: new Date().toISOString(),
				}),
			);
			remote.set(community, view.managingApp);
			syncGrants();
		} catch (error) {
			log.warn("could not remember a remote Space", {
				code: classifyThrown(error).code,
			});
		}
	};

	const reconcile = (
		views: CommunityView[],
		unavailable: readonly Required<Remote>[] = [],
	): CommunityView[] => {
		const kept = views.filter((view) => {
			if (!isRemote(view)) return true;

			if (isMemberOrPending(view)) {
				remote.set(view.did, view.managingApp);

				return view.viewer?.isMember === true;
			}

			remote.set(view.did, view.managingApp);
			void forget(view.did);

			return false;
		});

		for (const entry of unavailable) remote.set(entry.did, entry.managingApp);

		syncGrants();

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

	return { declare, joined, forget, reconcile, start };
};

export type Federation = ReturnType<typeof createFederation>;
