import { classifyThrown, createLogger } from "@colibri-social/lib";
import type { EmojiPackCardOwner, EmojiPackCardPack } from "@colibri-social/ui";
import { type Accessor, createMemo, createResource } from "solid-js";
import { displayNameOf } from "../adapters/authors";
import { type DataStore, useData } from "../store";
import type { Did, ProfileView } from "../types";
import { type PackTarget, type SharedPack, sharedPackIn } from "./shared-pack";

const log = createLogger("pack-preview");

const FALLBACK_OWNER_NAME = "Someone on Colibri";

export type PackPreviewState = "loading" | "failed" | "missing" | "ready";

const owners = new WeakMap<DataStore, Map<Did, Promise<EmojiPackCardOwner>>>();

const ownerFromProfile = (profile: ProfileView): EmojiPackCardOwner => ({
	did: profile.did,
	name: displayNameOf(profile),
	handle: profile.handle,
	avatarSrc: profile.avatar,
});

const fetchOwner = async (
	data: DataStore,
	did: Did,
): Promise<EmojiPackCardOwner> => {
	try {
		return ownerFromProfile(await data.source.getProfile(did));
	} catch (error) {
		try {
			const community = await data.source.getCommunity(did);
			return {
				did,
				name: community.name,
				handle: community.handle ?? "",
				avatarSrc: community.picture,
			};
		} catch {
			log.warn("loading a pack owner failed", {
				code: classifyThrown(error, { method: "actor.getProfile" }).code,
			});
			return { did, name: FALLBACK_OWNER_NAME, handle: "" };
		}
	}
};

const loadOwner = (data: DataStore, did: Did) => {
	let cache = owners.get(data);
	if (!cache) {
		cache = new Map();
		owners.set(data, cache);
	}
	const cached = cache.get(did);
	if (cached) return cached;
	const request = fetchOwner(data, did);
	cache.set(did, request);
	return request;
};

const knownOwner = (
	data: DataStore,
	did: Did,
): EmojiPackCardOwner | undefined => {
	if (did === data.viewer.did) return ownerFromProfile(data.viewer);
	const community = (data.communities.value() ?? []).find(
		(entry) => entry.did === did,
	);
	return community
		? {
				did,
				name: community.name,
				handle: community.handle ?? "",
				avatarSrc: community.picture,
			}
		: undefined;
};

const packFollows = (data: DataStore) => ({
	isFollowed: (shared: SharedPack) => !!data.emoji.followOf(shared.pack.id),
	set: async (shared: SharedPack, follow: boolean) => {
		if (follow) await data.emoji.follow(shared.pack.id);
		else await data.emoji.unfollow(shared.pack.id);
	},
});

export const usePackPreview = (target: Accessor<PackTarget | undefined>) => {
	const data = useData();
	const follows = packFollows(data);
	const catalog = () => {
		const current = target();
		return current ? data.emoji.catalog(current.did) : undefined;
	};
	const shared = createMemo(() => {
		const current = target();
		return current ? sharedPackIn(catalog()?.value(), current) : undefined;
	});
	const [fetchedOwner] = createResource(
		() => {
			const current = target();
			return current && !knownOwner(data, current.did)
				? current.did
				: undefined;
		},
		(did) => loadOwner(data, did),
	);
	const owner = () => {
		const current = target();
		if (!current) return undefined;
		return knownOwner(data, current.did) ?? fetchedOwner();
	};
	const own = () => target()?.did === data.viewer.did;
	const followed = () => {
		const current = shared();
		return current ? follows.isFollowed(current) : false;
	};

	const setFollowed = async (follow: boolean) => {
		const current = target();
		const pack = shared();
		if (!current || !pack) return;
		try {
			await follows.set(pack, follow);
		} catch (error) {
			log.warn("updating a shared pack follow failed", {
				code: classifyThrown(error, {
					method: "emoji.putFollow",
				}).code,
			});
			throw error;
		}
	};

	const pack = createMemo((): EmojiPackCardPack | undefined => {
		const current = shared();
		const by = owner();
		if (!current || !by) return undefined;
		return {
			name: current.pack.name,
			description: current.pack.description,
			owner: by,
			total: current.emojis.length,
			emojis: current.emojis.map((emoji) => ({
				id: emoji.id,
				name: emoji.name,
				src: emoji.image,
			})),
		};
	});

	const state = (): PackPreviewState => {
		const entry = catalog();
		if (!target()) return "missing";
		if (shared()) return pack() ? "ready" : "loading";
		if (entry?.loading()) return "loading";
		if (entry?.error()) return "failed";
		return "missing";
	};

	return {
		state,
		pack,
		own,
		followed,
		setFollowed,
		retry: () => void catalog()?.refresh(),
	};
};
