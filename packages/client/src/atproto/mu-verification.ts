import type { AppBskyGraphDefs } from "@atproto/api";
import { getProfiles } from "./xrpc/app/bsky/actor/getProfiles";

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

let trustedVerifierCache: { dids: Set<string>; expiresAt: number } | undefined;
const verificationCache = new Map<
	string,
	{ result: MuVerification | undefined; expiresAt: number }
>();

const fetchMuTrustedVerifierDids = async (): Promise<Set<string>> => {
	const dids = new Set<string>();
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
			for (const item of body.items) dids.add(item.subject.did);

			if (!body.cursor || body.items.length === 0) break;
			cursor = body.cursor;
		}
	} catch (err) {
		console.error(err);
	}

	return dids;
};

const getMuTrustedVerifierDids = async (): Promise<Set<string>> => {
	if (trustedVerifierCache && trustedVerifierCache.expiresAt > Date.now()) {
		return trustedVerifierCache.dids;
	}

	const dids = await fetchMuTrustedVerifierDids();
	trustedVerifierCache = { dids, expiresAt: Date.now() + TRUSTED_LIST_TTL_MS };
	return dids;
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
		console.error(err);
	}

	return issuers;
};

/**
 * Looks up whether `subjectDid` has been verified by a Mu-trusted verifier,
 * independent of Bluesky's own (unrelated) verification system
 */
export const getMuVerification = async (
	subjectDid: string,
): Promise<MuVerification | undefined> => {
	const cached = verificationCache.get(subjectDid);
	if (cached && cached.expiresAt > Date.now()) return cached.result;

	const [trustedDids, issuerDids] = await Promise.all([
		getMuTrustedVerifierDids(),
		fetchVerificationIssuers(subjectDid),
	]);

	const issuerDid = issuerDids.find((did) => trustedDids.has(did));
	let result: MuVerification | undefined;

	if (issuerDid) {
		const [profile] = await getProfiles([issuerDid]);
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
	return result;
};
