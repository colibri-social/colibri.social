import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { colibri } from "./lexicons";
import {
	clearPending,
	decideResume,
	type ResumeProbe,
	readPending,
} from "./pending-community";
import type { CommunityView } from "./views";
import type { ColibriClient } from "./xrpc";

const log = createLogger("community-resume");

export type ResumeOutcome =
	| { kind: "none" }
	| { kind: "wait" }
	| { kind: "abandoned"; name: string }
	| { kind: "done"; community: CommunityView; imagesDropped: boolean };

const probeCommunity = async (
	client: ColibriClient,
	did: string,
): Promise<{ probe: ResumeProbe; community?: CommunityView }> => {
	const res = await client.call(
		colibri.community.getCommunity.main,
		{ params: { community: did } },
		{ expected: ["CommunityNotFound", "NotFound"] },
	);

	if (res.ok) {
		return {
			probe: { found: true, isMember: res.data.community.viewer.isMember },
			community: res.data.community,
		};
	}

	if (res.error.code === "CommunityNotFound" || res.error.code === "NotFound") {
		return { probe: { found: false } };
	}

	return { probe: { unknown: true } };
};

export const resumePendingCommunity = async (
	client: ColibriClient,
	ns: string,
	nowMs: number = Date.now(),
): Promise<ResumeOutcome> => {
	const pending = readPending(ns);
	if (!pending) return { kind: "none" };

	const ageMs = nowMs - pending.startedAt;

	if (!pending.did) {
		const decision = decideResume({ found: false }, ageMs);
		if (decision === "wait") return { kind: "wait" };
		clearPending(ns);
		return { kind: "abandoned", name: pending.name };
	}

	const { probe, community } = await probeCommunity(client, pending.did);
	const decision = decideResume(probe, ageMs);

	if (decision === "wait") return { kind: "wait" };

	if (decision === "abandon" || !community) {
		log.warn("giving up on an unfinished community", {
			community: pending.did,
		});
		clearPending(ns);
		return { kind: "abandoned", name: pending.name };
	}

	let latest = community;

	if (pending.requiresApprovalToJoin && !community.requiresApprovalToJoin) {
		const updated = await client.call(colibri.community.update.main, {
			body: { community: latest.did, requiresApprovalToJoin: true },
		});
		if (updated.ok) {
			latest = updated.data.community;
		} else {
			log.warn("could not reapply the join setting", {
				code: updated.error.code,
			});
		}
	}

	clearPending(ns);
	return {
		kind: "done",
		community: latest,
		imagesDropped: pending.imagesDropped,
	};
};

export const resumeQuietly = async (
	client: ColibriClient,
	ns: string,
): Promise<ResumeOutcome> => {
	try {
		return await resumePendingCommunity(client, ns);
	} catch (err) {
		log.error("resuming a community creation failed", {
			code: classifyThrown(err).code,
		});
		return { kind: "wait" };
	}
};
