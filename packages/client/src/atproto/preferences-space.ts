import type { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import {
	asSpaceRef,
	colibri,
	preferencesSpace,
	SELF,
	SPACE_TYPES,
} from "./lexicons";
import type { ColibriClient } from "./xrpc";

const log = createLogger("preferences-space");

export const preferencesSpaceRef = (did: string): string =>
	asSpaceRef(preferencesSpace(did));

const errorNameOf = (err: unknown): string | undefined => {
	if (!err || typeof err !== "object") return undefined;
	const name = (err as { error?: unknown }).error;
	return typeof name === "string" ? name : undefined;
};

const isSpaceAlreadyExists = (err: unknown): boolean =>
	errorNameOf(err) === "SpaceAlreadyExists" ||
	classifyThrown(err).serverMessage?.includes("SpaceAlreadyExists") === true;

export const ensurePreferencesSpace = async (agent: Agent): Promise<void> => {
	try {
		await agent.com.atproto.simplespace.createSpace({
			type: SPACE_TYPES.actorPreferences,
			skey: SELF,
			policy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
			appAccess: { $type: "com.atproto.simplespace.defs#open" },
		});
	} catch (err) {
		if (isSpaceAlreadyExists(err)) return;
		const classified = classifyThrown(err, {
			method: "com.atproto.simplespace.createSpace",
		});
		log.error("failed to create the preferences space", {
			code: classified.code,
		});
		throw classified;
	}
};

export type PreferencesGrant = { expiresAt: string };

export const grantPreferencesAccess = async (
	agent: Agent,
	xrpc: ColibriClient,
): Promise<PreferencesGrant | undefined> => {
	const did = agent.did;
	if (!did) return undefined;
	const space = preferencesSpaceRef(did);

	try {
		const { data } = await agent.com.atproto.space.getDelegationToken({
			space,
		});
		const result = await xrpc.call(colibri.actor.grantSpaceAccess.main, {
			body: { space, delegationToken: data.token },
		});
		if (!result.ok) {
			log.warn("the appview declined the preferences grant", {
				code: result.error.code,
			});
			return undefined;
		}
		return { expiresAt: result.data.expiresAt };
	} catch (err) {
		log.warn("failed to grant preferences access", {
			code: classifyThrown(err, { method: "actor.grantSpaceAccess" }).code,
		});
		return undefined;
	}
};

const APPVIEW_RENEW_WINDOW_MS = 300_000;
const REGRANT_MARGIN_MS = 360_000;
const REGRANT_MIN_DELAY_MS = 30_000;
const REGRANT_RETRY_BASE_MS = 5_000;
const REGRANT_RETRY_MAX_MS = 120_000;

export const regrantDelay = (lifetimeMs: number): number =>
	Math.max(
		lifetimeMs - Math.max(REGRANT_MARGIN_MS, APPVIEW_RENEW_WINDOW_MS),
		REGRANT_MIN_DELAY_MS,
	);

export const regrantRetryDelay = (failures: number): number => {
	const capped = Math.min(
		REGRANT_RETRY_BASE_MS * 2 ** (failures - 1),
		REGRANT_RETRY_MAX_MS,
	);
	return capped * (0.8 + Math.random() * 0.4);
};

export const scheduleRegrant = (
	agent: Agent,
	xrpc: ColibriClient,
	expiresAt: string,
): (() => void) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let failures = 0;

	const lifetimeOf = (at: string) => new Date(at).getTime() - Date.now();

	const arm = (delay: number) => {
		if (stopped) return;
		timer = setTimeout(run, delay);
	};

	const run = () => {
		void grantPreferencesAccess(agent, xrpc).then((next) => {
			if (stopped) return;
			if (next) {
				failures = 0;
				arm(regrantDelay(lifetimeOf(next.expiresAt)));
				return;
			}
			failures += 1;
			log.warn("the preferences grant did not land, trying again", {
				failures,
			});
			arm(regrantRetryDelay(failures));
		});
	};

	arm(regrantDelay(lifetimeOf(expiresAt)));

	return () => {
		stopped = true;
		if (timer !== undefined) clearTimeout(timer);
	};
};
