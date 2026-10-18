import {
	collectionOfUri,
	DEFAULT_EMOJI_PROVIDER,
	EMOJI_PERMISSION,
	type EmojiCatalogView,
	EmojiError,
	type EmojiFollowView,
	type EmojiLibraryView,
	type EmojiPackView,
	type EmojiProvider,
	type EmojiRegistry,
	type EmojiSource,
	type EmojiView,
	emojiRegistry,
	type ProviderRecord,
	repoOfUri,
	rkeyOfUri,
	type StoredBlob,
	type WrittenRecord,
} from "../emoji";
import type { LiveEvent } from "../source";
import type { Did } from "../types";
import { withLatency } from "./latency";
import { asDatetime, tidFor } from "./refs";
import type { SpaceRecord, World } from "./world";

const DAY = 24 * 60 * 60_000;
const NAME_PATTERN = /^[a-z0-9_]{2,32}$/;
const PACK_NAME_MAX = 64;

type EmojiSeed = {
	name: string;
	glyph: string;
	fill: string;
	by: string;
	fallback?: string;
};
type PackSeed = { name: string; by: string; emojis: string[] };
type CatalogSeed = { emojis: EmojiSeed[]; packs: PackSeed[] };

const SEEDS: Record<string, CatalogSeed> = {
	hq: {
		emojis: [
			{ name: "colibri", glyph: "🐦", fill: "#8e51ff", by: "lou" },
			{
				name: "shipit",
				glyph: "🚀",
				fill: "#2f6fed",
				by: "mira",
				fallback: "🚀",
			},
			{ name: "lgtm", glyph: "✅", fill: "#1f9d6a", by: "tomas" },
			{ name: "party_bird", glyph: "🎉", fill: "#ff8a3d", by: "kris" },
			{ name: "bug", glyph: "🐛", fill: "#4d7c0f", by: "priya" },
			{ name: "coffee", glyph: "☕", fill: "#7c4a2d", by: "ana" },
		],
		packs: [
			{
				name: "Release day",
				by: "mira",
				emojis: ["shipit", "lgtm", "party_bird"],
			},
		],
	},
	owls: {
		emojis: [
			{
				name: "owl",
				glyph: "🦉",
				fill: "#6b4fd8",
				by: "lou",
				fallback: "🦉",
			},
			{ name: "brush", glyph: "🖌️", fill: "#d9467a", by: "noor" },
			{ name: "palette", glyph: "🎨", fill: "#e0a526", by: "noor" },
			{ name: "sparkle_art", glyph: "✨", fill: "#3b82f6", by: "ana" },
			{ name: "moon", glyph: "🌙", fill: "#1e293b", by: "kris" },
		],
		packs: [
			{
				name: "Pixelart by Lis",
				by: "noor",
				emojis: ["brush", "palette", "sparkle_art"],
			},
		],
	},
	trail: {
		emojis: [
			{ name: "boot", glyph: "🥾", fill: "#8b5e34", by: "lou" },
			{ name: "summit", glyph: "🏔️", fill: "#0f766e", by: "tomas" },
		],
		packs: [],
	},
};

export const emojiImage = (glyph: string, fill: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${fill}"/><text x="32" y="44" font-size="34" text-anchor="middle">${glyph}</text></svg>`,
	)}`;

type StoredRecord = { cid: string; value: Record<string, unknown> };

type Repo = {
	records: Map<string, StoredRecord>;
	createdBy: Map<string, Did>;
};

const svgBytes = (svg: string) => new TextEncoder().encode(svg).length;

export const createMockEmoji = (options: {
	world: World;
	now: number;
	emit: (event: LiveEvent) => void;
	registry?: EmojiRegistry;
}): EmojiSource => {
	const { world, now, emit } = options;
	const registry = options.registry ?? emojiRegistry;
	const repos = new Map<Did, Repo>();
	const follows = new Map<string, { subject: string; createdAt: string }>();
	const blobs = new Map<string, string>();
	let counter = 0;

	const nextCid = () =>
		`bafkreimock${(++counter).toString(36).padStart(6, "0")}`;
	const nextTid = () => tidFor(now + counter * 1000, ++counter);

	const locate = ({ cid }: { cid: string }) => blobs.get(cid) ?? "";

	const storeBlob = (
		src: string,
		mimeType: string,
		size: number,
	): StoredBlob => {
		const cid = nextCid();
		blobs.set(cid, src);
		return { cid, mimeType, size };
	};

	const personDid = (space: SpaceRecord, key: string) => {
		const fallback = space.seed.members[0] ?? key;
		const person =
			world.people.byKey.get(key) ?? world.people.byKey.get(fallback);
		return person?.did;
	};

	const spaceOf = (community: Did) => {
		const space = world.spaces.find((entry) => entry.did === community);
		if (!space) throw new Error(`Unknown community ${community}`);
		return space;
	};

	const providerOf = (id: string): EmojiProvider => {
		const provider = registry.get(id);
		if (!provider) throw new EmojiError("UnsupportedProvider");
		return provider;
	};

	const put = (
		repo: Repo,
		owner: Did,
		written: WrittenRecord,
		author?: Did,
	) => {
		const uri = `at://${owner}/${written.collection}/${written.rkey}`;
		repo.records.set(uri, { cid: nextCid(), value: written.value });
		if (author) repo.createdBy.set(uri, author);
		return uri;
	};

	const repoOf = (community: Did): Repo => {
		const existing = repos.get(community);
		if (existing) return existing;
		const repo: Repo = { records: new Map(), createdBy: new Map() };
		if (community === world.viewerDid) {
			repos.set(community, repo);
			return repo;
		}
		const space = spaceOf(community);
		repos.set(community, repo);
		const provider = providerOf(DEFAULT_EMOJI_PROVIDER);
		const seed = SEEDS[space.seed.key] ?? { emojis: [], packs: [] };
		const byName = new Map<string, string>();
		seed.emojis.forEach((entry, index) => {
			const src = emojiImage(entry.glyph, entry.fill);
			const written = provider.writeItem({
				owner: community,
				name: entry.name,
				fallback: entry.fallback,
				image: storeBlob(src, "image/png", svgBytes(src)),
				createdAt: asDatetime(now - (seed.emojis.length - index) * DAY),
			});
			byName.set(
				entry.name,
				put(repo, community, written, personDid(space, entry.by)),
			);
		});
		seed.packs.forEach((entry, index) => {
			if (!provider.writePack) return;
			const createdAt = asDatetime(now - (index + 1) * DAY);
			const pack = put(
				repo,
				community,
				provider.writePack({
					owner: community,
					rkey: nextTid(),
					name: entry.name,
					createdAt,
				}),
				personDid(space, entry.by),
			);
			entry.emojis.forEach((name, position) => {
				const emoji = byName.get(name);
				if (!emoji || !provider.writeMembership) return;
				put(
					repo,
					community,
					provider.writeMembership({
						owner: community,
						rkey: nextTid(),
						emoji,
						pack,
						createdAt: asDatetime(now - (index + 1) * DAY + position),
					}),
				);
			});
		});
		return repo;
	};

	const recordsIn = (repo: Repo, collection: string | undefined) => {
		const out: ProviderRecord[] = [];
		if (!collection) return out;
		for (const [uri, record] of repo.records) {
			if (collectionOfUri(uri) === collection) {
				out.push({ uri, cid: record.cid, value: record.value });
			}
		}
		return out;
	};

	const snapshot = (community: Did): EmojiCatalogView => {
		const repo = repoOf(community);
		const emojis: EmojiView[] = [];
		const packs: EmojiPackView[] = [];
		for (const provider of registry.providers) {
			const items = recordsIn(repo, provider.collections.item)
				.map((record) => provider.readItem(record, locate))
				.filter((emoji): emoji is EmojiView => !!emoji)
				.map((emoji) => ({ ...emoji, createdBy: repo.createdBy.get(emoji.id) }))
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
			emojis.push(...items);
			const read = provider.readPacks?.({
				packs: recordsIn(repo, provider.collections.pack),
				memberships: recordsIn(repo, provider.collections.membership),
				emojis: items,
			});
			for (const pack of read ?? []) {
				packs.push({ ...pack, createdBy: repo.createdBy.get(pack.id) });
			}
		}
		packs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		return { community, emojis, packs };
	};

	const ownerView = (owner: Did) => {
		if (owner === world.viewerDid) return { did: owner, kind: "user" as const };
		const space = world.spaces.find((entry) => entry.did === owner);
		return {
			did: owner,
			kind: "community" as const,
			displayName: space?.view.name,
			handle: space?.view.handle,
			avatar: space?.view.picture,
		};
	};

	const followView = (rkey: string): EmojiFollowView | undefined => {
		const record = follows.get(rkey);
		if (!record) return undefined;
		const owner = repoOfUri(record.subject);
		const kind =
			collectionOfUri(record.subject) ===
			providerOf(DEFAULT_EMOJI_PROVIDER).collections.pack
				? "pack"
				: "emoji";
		const base = {
			uri: `at://${world.viewerDid}/social.colibri.beta.emoji.follow/${rkey}`,
			rkey,
			subject: record.subject,
			kind,
			owner: ownerView(owner),
			createdAt: asDatetime(Date.parse(record.createdAt)),
		} as const;
		if (!world.spaces.some((space) => space.did === owner))
			return { ...base, state: "unreachable", emojis: [] };
		const catalog = snapshot(owner);
		if (kind === "pack") {
			const pack = catalog.packs.find((entry) => entry.id === record.subject);
			if (!pack) return { ...base, state: "missing", emojis: [] };
			const byId = new Map(catalog.emojis.map((emoji) => [emoji.id, emoji]));
			return {
				...base,
				state: "available",
				pack,
				emojis: pack.emojis
					.map((id) => byId.get(id))
					.filter((emoji): emoji is EmojiView => !!emoji),
			};
		}
		const emoji = catalog.emojis.find((entry) => entry.id === record.subject);
		return emoji
			? { ...base, state: "available", emojis: [emoji] }
			: { ...base, state: "missing", emojis: [] };
	};

	const library = (): EmojiLibraryView => ({
		own: snapshot(world.viewerDid),
		follows: [...follows.entries()]
			.sort(([, a], [, b]) => a.createdAt.localeCompare(b.createdAt))
			.flatMap(([rkey]) => {
				const view = followView(rkey);
				return view ? [view] : [];
			}),
	});

	const publishLibrary = () =>
		emit({ $type: "emojiLibraryEvent", library: library() });

	const publish = (community: Did) => {
		emit({ $type: "emojiEvent", catalog: snapshot(community) });
		if (
			community === world.viewerDid ||
			[...follows.values()].some(
				(record) => repoOfUri(record.subject) === community,
			)
		)
			publishLibrary();
	};

	const requireManage = (community: Did) => {
		if (community === world.viewerDid) return;
		const viewer = spaceOf(community).view.viewer;
		if (!viewer.isOwner && !viewer.permissions?.includes(EMOJI_PERMISSION)) {
			throw new EmojiError("Forbidden");
		}
	};

	const checkName = (
		catalog: EmojiCatalogView,
		name: string,
		except?: string,
	) => {
		if (!NAME_PATTERN.test(name)) throw new EmojiError("InvalidName");
		if (
			catalog.emojis.some((emoji) => emoji.name === name && emoji.id !== except)
		) {
			throw new EmojiError("NameTaken");
		}
	};

	const checkPackName = (name: string) => {
		const trimmed = name.trim();
		if (!trimmed || trimmed.length > PACK_NAME_MAX || /\bfail\b/i.test(trimmed))
			throw new EmojiError("InvalidName");
		return trimmed;
	};

	const emojiIn = (catalog: EmojiCatalogView, id: string) => {
		const emoji = catalog.emojis.find((entry) => entry.id === id);
		if (!emoji) throw new EmojiError("EmojiNotFound");
		return emoji;
	};

	const packIn = (catalog: EmojiCatalogView, id: string) => {
		const pack = catalog.packs.find((entry) => entry.id === id);
		if (!pack) throw new EmojiError("PackNotFound");
		return pack;
	};

	const membershipsOf = (repo: Repo, pack: EmojiPackView) => {
		const provider = providerOf(pack.provider);
		return recordsIn(repo, provider.collections.membership).filter(
			(record) => (record.value as { pack?: string }).pack === pack.id,
		);
	};

	const setMembers = (
		community: Did,
		pack: EmojiPackView,
		emojis: readonly string[],
	) => {
		const repo = repoOf(community);
		const provider = providerOf(pack.provider);
		if (!provider.writeMembership) return;
		const known = new Set(snapshot(community).emojis.map((emoji) => emoji.id));
		const wanted = [...new Set(emojis)].filter((id) => known.has(id));
		for (const record of membershipsOf(repo, pack)) {
			repo.records.delete(record.uri);
		}
		wanted.forEach((emoji, position) => {
			put(
				repo,
				community,
				provider.writeMembership?.({
					owner: community,
					rkey: nextTid(),
					emoji,
					pack: pack.id,
					createdAt: asDatetime(Date.now() + position),
				}) as WrittenRecord,
			);
		});
	};

	const ownerRepo = (uri: string) => {
		const owner = repoOfUri(uri);
		if (
			owner !== world.viewerDid &&
			!world.spaces.some((space) => space.did === owner)
		) {
			throw new EmojiError("EmojiNotFound");
		}
		return owner;
	};

	const viewOf = (community: Did, id: string) =>
		emojiIn(snapshot(community), id);

	const packView = (community: Did, id: string) =>
		packIn(snapshot(community), id);

	return {
		emojiBlobUrl: locate,
		listEmoji: (community) => withLatency(() => snapshot(community)),
		uploadEmoji: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const provider = providerOf(input.provider ?? DEFAULT_EMOJI_PROVIDER);
				const catalog = snapshot(input.community);
				checkName(catalog, input.name);
				if (/fail/i.test(input.file.name)) throw new EmojiError("UploadFailed");
				const pack = input.pack ? packIn(catalog, input.pack) : undefined;
				const repo = repoOf(input.community);
				const uri = put(
					repo,
					input.community,
					provider.writeItem({
						owner: input.community,
						name: input.name,
						image: storeBlob(
							URL.createObjectURL(input.file),
							input.file.type || "image/png",
							input.file.size,
						),
						createdAt: asDatetime(Date.now()),
					}),
					world.viewerDid,
				);
				if (pack) setMembers(input.community, pack, [...pack.emojis, uri]);
				publish(input.community);
				return viewOf(input.community, uri);
			}),
		renameEmoji: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const catalog = snapshot(input.community);
				const emoji = emojiIn(catalog, input.emoji);
				checkName(catalog, input.name, emoji.id);
				const repo = repoOf(input.community);
				const provider = providerOf(emoji.ref.provider);
				const stored = repo.records.get(emoji.id);
				if (!stored) throw new EmojiError("EmojiNotFound");
				const written = provider.writeItem({
					owner: input.community,
					name: input.name,
					alt: emoji.alt,
					image: {
						cid: emoji.images[0]?.cid ?? nextCid(),
						mimeType: emoji.images[0]?.mimeType ?? "image/png",
						size: emoji.images[0]?.size ?? 0,
					},
					createdAt: emoji.createdAt,
				});
				const value = {
					...stored.value,
					...written.value,
					formats: stored.value.formats,
				};
				const author = repo.createdBy.get(emoji.id);
				repo.records.delete(emoji.id);
				repo.createdBy.delete(emoji.id);
				const uri = put(repo, input.community, { ...written, value }, author);
				if (uri !== emoji.id) {
					for (const [key, record] of repo.records) {
						if ((record.value as { subject?: string }).subject === emoji.id) {
							repo.records.set(key, {
								...record,
								value: { ...record.value, subject: uri },
							});
						}
					}
				}
				publish(input.community);
				return viewOf(input.community, uri);
			}),
		deleteEmoji: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const emoji = emojiIn(snapshot(input.community), input.emoji);
				const repo = repoOf(input.community);
				repo.records.delete(emoji.id);
				repo.createdBy.delete(emoji.id);
				for (const [key, record] of repo.records) {
					if ((record.value as { subject?: string }).subject === emoji.id) {
						repo.records.delete(key);
					}
				}
				publish(input.community);
			}),
		createEmojiPack: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const provider = providerOf(DEFAULT_EMOJI_PROVIDER);
				if (!provider.writePack) throw new EmojiError("UnsupportedProvider");
				const name = checkPackName(input.name);
				const repo = repoOf(input.community);
				const uri = put(
					repo,
					input.community,
					provider.writePack({
						owner: input.community,
						rkey: nextTid(),
						name,
						createdAt: asDatetime(Date.now()),
					}),
					world.viewerDid,
				);
				setMembers(
					input.community,
					packView(input.community, uri),
					input.emojis,
				);
				publish(input.community);
				return packView(input.community, uri);
			}),
		updateEmojiPack: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const pack = packView(input.community, input.pack);
				const repo = repoOf(input.community);
				if (input.name !== undefined) {
					const name = checkPackName(input.name);
					const stored = repo.records.get(pack.id);
					if (stored) {
						repo.records.set(pack.id, {
							cid: nextCid(),
							value: { ...stored.value, name },
						});
					}
				}
				if (input.emojis) setMembers(input.community, pack, input.emojis);
				publish(input.community);
				return packView(input.community, pack.id);
			}),
		deleteEmojiPack: (input) =>
			withLatency(() => {
				requireManage(input.community);
				const pack = packView(input.community, input.pack);
				const repo = repoOf(input.community);
				for (const record of membershipsOf(repo, pack)) {
					repo.records.delete(record.uri);
				}
				repo.records.delete(pack.id);
				repo.createdBy.delete(pack.id);
				publish(input.community);
			}),
		getEmojiLibrary: () => withLatency(library),
		followEmoji: (input) =>
			withLatency(() => {
				const owner = ownerRepo(input.subject);
				if (owner === world.viewerDid) throw new EmojiError("OwnEmoji");
				const catalog = snapshot(owner);
				const exists =
					catalog.emojis.some((emoji) => emoji.id === input.subject) ||
					catalog.packs.some((pack) => pack.id === input.subject);
				if (!exists) {
					const pack =
						collectionOfUri(input.subject) ===
						providerOf(DEFAULT_EMOJI_PROVIDER).collections.pack;
					throw new EmojiError(pack ? "PackNotFound" : "EmojiNotFound");
				}
				for (const [rkey, record] of follows) {
					if (record.subject === input.subject) follows.delete(rkey);
				}
				const rkey = nextTid();
				follows.set(rkey, {
					subject: input.subject,
					createdAt: new Date(now + counter).toISOString(),
				});
				publishLibrary();
				return followView(rkey) as EmojiFollowView;
			}),
		unfollowEmoji: (input) =>
			withLatency(() => {
				follows.delete(rkeyOfUri(input.rkey));
				publishLibrary();
			}),
	};
};
