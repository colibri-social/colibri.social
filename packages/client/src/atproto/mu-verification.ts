import type { AppBskyGraphDefs } from "@atproto/api";
import { createLogger } from "../utils/logger";
import {
	cacheEnabled,
	readBskyMuTrustedList,
	readBskyMuVerification,
	writeBskyMuTrustedList,
	writeBskyMuVerification,
} from "./cache/store";
import { getProfiles } from "./xrpc/app/bsky/actor/getProfiles";

const log = createLogger("verification");

const PUBLIC_APPVIEW = "https://public.api.bsky.app";
const CONSTELLATION_SERVICE = "https://constellation.microcosm.blue";

/**
 * Mu (mu.social) curates its own allowlist of accounts it trusts to issue
 * `app.bsky.graph.verification` records, published as an ordinary Bluesky
 * list.
 */
const MU_TRUSTED_VERIFIER_LIST_URI =
	"at://did:plc:ooensn4mr5mhznzypvxelfa3/app.bsky.graph.list/3mogaw2g4an23";

const TRUSTED_LIST_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const MAX_BACKLINK_PAGES = 5;

export type MuVerification = {
	issuerDid: string;
	issuerHandle: string;
	issuerDisplayName?: string;
};

type TrustedProfile = { handle: string; displayName?: string };

let trustedVerifierCache:
	| { profiles: Map<string, TrustedProfile>; expiresAt: number }
	| undefined;
let inflightTrustedVerifierProfiles:
	| Promise<Map<string, TrustedProfile>>
	| undefined;
const verificationCache = new Map<
	string,
	{ result: MuVerification | undefined; expiresAt: number }
>();
const inflightVerifications = new Map<
	string,
	Promise<MuVerification | undefined>
>();

const fetchMuTrustedVerifierDids = async (): Promise<Array<string>> => {
	const dids: Array<string> = [];
	let cursor: string | undefined;

	try {
		for (let page = 0; page < MAX_BACKLINK_PAGES; page++) {
			const params = new URLSearchParams({
				list: MU_TRUSTED_VERIFIER_LIST_URI,
				limit: "100",
			});
			if (cursor) params.set("cursor", cursor);

			const res = await fetch(
				`${PUBLIC_APPVIEW}/xrpc/app.bsky.graph.getList?${params}`,
			);
			if (!res.ok) break;

			const body = (await res.json()) as {
				cursor?: string;
				items: Array<AppBskyGraphDefs.ListItemView>;
			};
			for (const item of body.items) dids.push(item.subject.did);

			if (!body.cursor || body.items.length === 0) break;
			cursor = body.cursor;
		}
	} catch (err) {
		log.warn("listing verified accounts failed", { error: err });
	}

	return dids;
};

/**
 * Fetches the Mu trusted-verifier list's membership and batch-resolves all
 * of their profiles in the same round trip
 */
const getMuTrustedVerifierProfiles = (): Promise<
	Map<string, TrustedProfile>
> => {
	if (trustedVerifierCache && trustedVerifierCache.expiresAt > Date.now()) {
		return Promise.resolve(trustedVerifierCache.profiles);
	}

	if (inflightTrustedVerifierProfiles) return inflightTrustedVerifierProfiles;

	const promise = (async () => {
		if (cacheEnabled()) {
			const cached = await readBskyMuTrustedList();
			if (cached && Date.now() - cached.ts < TRUSTED_LIST_TTL_MS) {
				trustedVerifierCache = {
					profiles: cached.profiles,
					expiresAt: cached.ts + TRUSTED_LIST_TTL_MS,
				};
				return cached.profiles;
			}
		}

		const dids = await fetchMuTrustedVerifierDids();
		const profiles = new Map<string, TrustedProfile>();
		if (dids.length > 0) {
			const fetched = await getProfiles(dids);
			for (const profile of fetched) {
				profiles.set(profile.did, {
					handle: profile.handle,
					displayName: profile.displayName,
				});
			}
		}

		trustedVerifierCache = {
			profiles,
			expiresAt: Date.now() + TRUSTED_LIST_TTL_MS,
		};
		void writeBskyMuTrustedList({ profiles, ts: Date.now() });
		return profiles;
	})().finally(() => {
		inflightTrustedVerifierProfiles = undefined;
	});

	inflightTrustedVerifierProfiles = promise;
	return promise;
};

/**
 * Whether `did` is itself a member of Mu's trusted-verifier list
 */
export const isMuTrustedVerifier = async (did: string): Promise<boolean> => {
	const profiles = await getMuTrustedVerifierProfiles();
	return profiles.has(did);
};

const fetchVerificationIssuers = async (
	subjectDid: string,
): Promise<Array<string>> => {
	const issuers: Array<string> = [];
	let cursor: string | undefined;

	try {
		for (let page = 0; page < MAX_BACKLINK_PAGES; page++) {
			const params = new URLSearchParams({
				subject: subjectDid,
				source: "app.bsky.graph.verification:subject",
				limit: "100",
			});
			if (cursor) params.set("cursor", cursor);

			const res = await fetch(
				`${CONSTELLATION_SERVICE}/xrpc/blue.microcosm.links.getBacklinks?${params}`,
			);
			if (!res.ok) break;

			const body = (await res.json()) as {
				cursor?: string;
				records: Array<{ did: string }>;
			};
			for (const record of body.records ?? []) issuers.push(record.did);

			if (!body.cursor || (body.records ?? []).length === 0) break;
			cursor = body.cursor;
		}
	} catch (err) {
		log.warn("listing verification issuers failed", { error: err });
	}

	return issuers;
};

/**
 * Looks up whether `subjectDid` has been verified by a Mu-trusted verifier,
 * independent of Bluesky's own (unrelated) verification system
 */
export const getMuVerification = (
	subjectDid: string,
): Promise<MuVerification | undefined> => {
	const cached = verificationCache.get(subjectDid);
	if (cached && cached.expiresAt > Date.now()) {
		return Promise.resolve(cached.result);
	}

	const existing = inflightVerifications.get(subjectDid);
	if (existing) return existing;

	const promise = (async () => {
		if (cacheEnabled()) {
			const cached = await readBskyMuVerification(subjectDid);
			if (cached && Date.now() - cached.ts < VERIFICATION_TTL_MS) {
				const result = cached.result ?? undefined;
				verificationCache.set(subjectDid, {
					result,
					expiresAt: cached.ts + VERIFICATION_TTL_MS,
				});
				return result;
			}
		}

		const [trustedProfiles, issuerDids] = await Promise.all([
			getMuTrustedVerifierProfiles(),
			fetchVerificationIssuers(subjectDid),
		]);

		const issuerDid = issuerDids.find((did) => trustedProfiles.has(did));
		let result: MuVerification | undefined;

		if (issuerDid) {
			const profile = trustedProfiles.get(issuerDid);
			result = profile
				? {
						issuerDid,
						issuerHandle: profile.handle,
						issuerDisplayName: profile.displayName,
					}
				: { issuerDid, issuerHandle: issuerDid };
		}

		verificationCache.set(subjectDid, {
			result,
			expiresAt: Date.now() + VERIFICATION_TTL_MS,
		});
		void writeBskyMuVerification(subjectDid, {
			result: result ?? null,
			ts: Date.now(),
		});
		return result;
	})().finally(() => {
		inflightVerifications.delete(subjectDid);
	});

	inflightVerifications.set(subjectDid, promise);
	return promise;
};
