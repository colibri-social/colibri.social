import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import {
	AcknowledgementsSettings,
	type Contributor,
	type OpenSourceLibrary,
} from "@colibri-social/ui";
import { createStore } from "solid-js/store";
import { resolveHandleToDid, resolvePdsHost } from "../../../auth/identity";
import {
	blueskyClientOf,
	buildBskyProfileUrl,
} from "../../../data/bluesky-client";
import { type DataStore, useData } from "../../../data/store";
import type { Did } from "../../../data/types";
import type { Platform } from "../../../screen/platform";
import generated from "../acknowledgements.generated.json";
import { CONTRIBUTORS, type ContributorEntry } from "../contributors";

const log = createLogger("acknowledgements");

const LIBRARIES = generated.libraries as OpenSourceLibrary[];

const PROFILE_RECORD_TIMEOUT_MS = 6_000;

type BlobRef = { ref?: { $link?: string }; cid?: string };

type ProfileRecord = { value?: { avatar?: BlobRef } };

const contributorKey = (entry: ContributorEntry) => entry.did ?? entry.handle;

const contributorsWithLinks = (
	entries: readonly ContributorEntry[],
	profileUrl: (identifier: string) => string,
): Contributor[] =>
	entries.map((entry) => {
		const identifier = contributorKey(entry);
		return {
			...entry,
			href: identifier ? profileUrl(identifier) : undefined,
		};
	});

const blobCid = (blob: BlobRef | undefined) => blob?.ref?.$link ?? blob?.cid;

const pdsAvatar = async (did: string): Promise<string | undefined> => {
	const host = await resolvePdsHost(did);
	if (!host) return undefined;
	const pds = `https://${host}`;
	const method = "com.atproto.repo.getRecord";
	const query = new URLSearchParams({
		repo: did,
		collection: "app.bsky.actor.profile",
		rkey: "self",
	});
	let res: Response;
	try {
		res = await fetch(`${pds}/xrpc/${method}?${query}`, {
			signal: AbortSignal.timeout(PROFILE_RECORD_TIMEOUT_MS),
		});
	} catch (error) {
		throw classifyThrown(error, { method });
	}
	if (!res.ok) {
		throw new ColibriError({
			code: res.status >= 500 ? "UpstreamFailure" : "NotFound",
			status: res.status,
			method,
		});
	}
	const cid = blobCid(((await res.json()) as ProfileRecord).value?.avatar);
	if (!cid) return undefined;
	return `${pds}/xrpc/com.atproto.sync.getBlob?${new URLSearchParams({ did, cid })}`;
};

const fetchAvatar = async (
	data: DataStore,
	entry: ContributorEntry,
): Promise<string | undefined> => {
	const did =
		entry.did ??
		(entry.handle ? await resolveHandleToDid(entry.handle) : undefined);
	if (!did) return undefined;
	try {
		const profile = await data.source.getProfile(did as Did);
		if (profile.avatar) return profile.avatar;
	} catch (error) {
		log.debug("loading a contributor profile failed", {
			code: classifyThrown(error, { method: "actor.getProfile" }).code,
		});
	}
	return pdsAvatar(did);
};

const avatars = new WeakMap<
	DataStore,
	Map<string, Promise<string | undefined>>
>();

export const loadContributorAvatar = (
	data: DataStore,
	entry: ContributorEntry,
): Promise<string | undefined> => {
	const key = contributorKey(entry);
	if (!key) return Promise.resolve(undefined);
	let cache = avatars.get(data);
	if (!cache) {
		cache = new Map();
		avatars.set(data, cache);
	}
	const cached = cache.get(key);
	if (cached) return cached;
	const request = fetchAvatar(data, entry).catch((error: unknown) => {
		log.debug("loading a contributor avatar failed", {
			code: classifyThrown(error).code,
		});
		return undefined;
	});
	cache.set(key, request);
	return request;
};

export default function AcknowledgementsPage(_props: { platform: Platform }) {
	const data = useData();
	const [loaded, setLoaded] = createStore<Record<string, string>>({});
	for (const entry of CONTRIBUTORS) {
		const key = contributorKey(entry);
		if (!key) continue;
		void loadContributorAvatar(data, entry).then((avatar) => {
			if (avatar) setLoaded(key, avatar);
		});
	}
	const contributors = () =>
		contributorsWithLinks(CONTRIBUTORS, (identifier) =>
			buildBskyProfileUrl(blueskyClientOf(data.preferences), identifier),
		).map((contributor) => {
			const key = contributor.did ?? contributor.handle;
			return { ...contributor, avatar: key ? loaded[key] : undefined };
		});
	return (
		<AcknowledgementsSettings
			contributors={contributors()}
			libraries={LIBRARIES}
		/>
	);
}
