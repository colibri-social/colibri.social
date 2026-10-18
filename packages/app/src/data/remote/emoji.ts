import {
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
	nextTid,
} from "@colibri-social/lib";
import {
	type BlobLocator,
	bestImage,
	collectionOfUri,
	DEFAULT_EMOJI_PROVIDER,
	type EmojiCatalogView,
	EmojiError,
	type EmojiFollowState,
	type EmojiFollowView,
	type EmojiFormat,
	type EmojiImage,
	type EmojiLibraryView,
	type EmojiOwner,
	type EmojiPackView,
	type EmojiProvider,
	type EmojiRegistry,
	type EmojiSource,
	type EmojiView,
	emojiRegistry,
	rkeyOfUri,
	type StoredBlob,
	type WrittenRecord,
} from "../emoji";
import type { PreferencesSpace } from "../preferences/remote";
import type { LiveEvent } from "../source";
import type { Datetime, Did } from "../types";
import type { Records } from "./records";
import type { Transport } from "./transport";

const log = createLogger("emoji");

type WireCatalog = {
	owner: string;
	emojis: readonly WireEmoji[];
	packs: readonly WirePack[];
};

type WireEmoji = {
	uri: string;
	cid?: string;
	provider: string;
	owner: string;
	name: string;
	alt?: string;
	fallback?: string;
	images: readonly {
		cid: string;
		format: string;
		mimeType?: string;
		size?: number;
		animated: boolean;
		pixels?: number;
	}[];
	adultOnly?: boolean;
	createdAt: string;
};

type WirePack = {
	uri: string;
	provider: string;
	owner: string;
	name: string;
	description?: string;
	emojis: readonly string[];
	createdAt: string;
};

type WireOwner = {
	did: string;
	kind: string;
	handle?: string;
	displayName?: string;
	avatar?: string;
};

type WireFollow = {
	uri: string;
	subject: string;
	kind: string;
	state: string;
	owner: WireOwner;
	pack?: WirePack;
	emojis?: readonly WireEmoji[];
	createdAt: string;
};

export type WireLibrary = {
	own: WireCatalog;
	follows: readonly WireFollow[];
};

const NAME_PATTERN = /^[a-z0-9_]{2,32}$/;
const PACK_NAME_MAX = 64;

const FORMATS: ReadonlySet<string> = new Set<EmojiFormat>([
	"png",
	"webp",
	"gif",
	"apng",
	"lottie",
	"other",
]);

const EMOJI_CODES: ReadonlySet<string> = new Set<EmojiError["code"]>([
	"Forbidden",
	"InvalidName",
	"NameTaken",
	"EmojiNotFound",
	"PackNotFound",
	"UploadFailed",
	"UnsupportedProvider",
	"ImageTooLarge",
	"UnsupportedImage",
	"OwnEmoji",
	"UpstreamFailure",
]);

const isEmojiCode = (code: unknown): code is EmojiError["code"] =>
	typeof code === "string" && EMOJI_CODES.has(code);

export const emojiFailure = (error: unknown, method: string) => {
	if (error instanceof EmojiError) return error;
	const failure = classifyThrown(error, { method });
	if (isEmojiCode(failure.code)) return new EmojiError(failure.code);
	const unknownCode = failure.context.unknownCode;
	if (isEmojiCode(unknownCode)) return new EmojiError(unknownCode);
	return failure;
};

export const appViewOrigin = (did: string) => {
	if (!did.startsWith("did:web:")) return undefined;
	const host = decodeURIComponent(did.slice("did:web:".length));
	return host.startsWith("localhost")
		? `http://${host.replace("localhost", "127.0.0.1")}`
		: `https://${host}`;
};

export const emojiBlobLocator =
	(origin: string | undefined): BlobLocator =>
	(blob) => {
		const query = new URLSearchParams({ did: blob.did, cid: blob.cid });
		return `${origin ?? ""}/xrpc/${colibri.blob.get.main.nsid}?${query}`;
	};

export const emojiFromWire = (
	wire: WireEmoji,
	locate: BlobLocator,
): EmojiView | undefined => {
	const owner = wire.owner as Did;
	const images: EmojiImage[] = wire.images.map((image) => ({
		src: locate({ did: owner, cid: image.cid, mimeType: image.mimeType }),
		cid: image.cid,
		format: FORMATS.has(image.format) ? (image.format as EmojiFormat) : "other",
		animated: image.animated,
		mimeType: image.mimeType,
		size: image.size,
		pixels: image.pixels,
	}));
	const image = bestImage(images);
	if (!image) return undefined;
	return {
		id: wire.uri,
		ref: { provider: wire.provider, uri: wire.uri, owner, cid: wire.cid },
		name: wire.name,
		alt: wire.alt,
		fallback: wire.fallback,
		images,
		image: image.src,
		adultOnly: wire.adultOnly,
		createdAt: wire.createdAt as Datetime,
	};
};

const packFromWire = (wire: WirePack): EmojiPackView => ({
	id: wire.uri,
	provider: wire.provider,
	name: wire.name,
	description: wire.description,
	emojis: [...wire.emojis],
	createdAt: wire.createdAt as Datetime,
});

export const catalogFromWire = (
	wire: WireCatalog,
	locate: BlobLocator,
): EmojiCatalogView => ({
	community: wire.owner as Did,
	emojis: wire.emojis.flatMap((emoji) => {
		const view = emojiFromWire(emoji, locate);
		return view ? [view] : [];
	}),
	packs: wire.packs.map(packFromWire),
});

const FOLLOW_STATES: ReadonlySet<string> = new Set<EmojiFollowState>([
	"available",
	"missing",
	"unreachable",
]);

const ownerFromWire = (wire: WireOwner): EmojiOwner => ({
	did: wire.did as Did,
	kind: wire.kind === "community" ? "community" : "user",
	handle: wire.handle,
	displayName: wire.displayName,
	avatar: wire.avatar,
});

export const followFromWire = (
	wire: WireFollow,
	locate: BlobLocator,
): EmojiFollowView => ({
	uri: wire.uri,
	rkey: rkeyOfUri(wire.uri),
	subject: wire.subject,
	kind: wire.kind === "pack" ? "pack" : "emoji",
	state: FOLLOW_STATES.has(wire.state)
		? (wire.state as EmojiFollowState)
		: "unreachable",
	owner: ownerFromWire(wire.owner),
	pack: wire.pack ? packFromWire(wire.pack) : undefined,
	emojis: (wire.emojis ?? []).flatMap((emoji) => {
		const view = emojiFromWire(emoji, locate);
		return view ? [view] : [];
	}),
	createdAt: wire.createdAt as Datetime,
});

export const libraryFromWire = (
	wire: WireLibrary,
	locate: BlobLocator,
): EmojiLibraryView => ({
	own: catalogFromWire(wire.own, locate),
	follows: wire.follows.map((follow) => followFromWire(follow, locate)),
});

const uriOf = (owner: Did, written: WrittenRecord) =>
	`at://${owner}/${written.collection}/${written.rkey}`;

const now = () => new Date().toISOString() as Datetime;

export const createRemoteEmoji = (input: {
	transport: Transport;
	records: Records;
	space: PreferencesSpace;
	viewer: Did;
	locate: BlobLocator;
	emit: (event: LiveEvent) => void;
	registry?: EmojiRegistry;
}): Omit<EmojiSource, "emojiBlobUrl"> & {
	observe: (event: LiveEvent) => void;
} => {
	const { transport, records, space, viewer, locate, emit } = input;
	const registry = input.registry ?? emojiRegistry;

	let own: EmojiCatalogView | undefined;

	const call = async <T>(method: string, run: () => Promise<T>) => {
		try {
			return await run();
		} catch (error) {
			const failure = emojiFailure(error, method);
			if (failure instanceof ColibriError)
				log.warn("emoji request failed", { method, code: failure.code });
			throw failure;
		}
	};

	const fetchCatalog = async (owner: Did) => {
		const result = await transport.query(colibri.emoji.getCatalog.main, {
			params: { owner },
		});
		const catalog = catalogFromWire(result.catalog as WireCatalog, locate);
		if (owner === viewer) own = catalog;
		return catalog;
	};

	const viewerCatalog = async () => own ?? (await fetchCatalog(viewer));

	const publishViewer = (catalog: EmojiCatalogView) => {
		own = catalog;
		emit({ $type: "emojiEvent", catalog });
	};

	const providerOf = (id: string): EmojiProvider => {
		const provider = registry.get(id);
		if (!provider) throw new EmojiError("UnsupportedProvider");
		return provider;
	};

	const packProviderOf = (id: string) => {
		const provider = providerOf(id);
		const { writePack, writeMembership, collections } = provider;
		if (!writePack || !writeMembership || !collections.membership)
			throw new EmojiError("UnsupportedProvider");
		return {
			provider,
			writePack,
			writeMembership,
			membership: collections.membership,
		};
	};

	const put = async (written: WrittenRecord) => {
		const result = await records.putInRepo(
			written.collection,
			written.rkey,
			written.value,
		);
		return { uri: uriOf(viewer, written), cid: result.cid };
	};

	const removeUri = (uri: string) =>
		records.deleteInRepo(collectionOfUri(uri), rkeyOfUri(uri));

	const stored = (blob: {
		ref: { $link: string };
		mimeType: string;
		size: number;
	}): StoredBlob => ({
		cid: blob.ref.$link,
		mimeType: blob.mimeType,
		size: blob.size,
	});

	const readBack = (written: WrittenRecord, uri: string, cid?: string) => {
		const view = registry.readItem({ uri, cid, value: written.value }, locate);
		if (!view) throw new EmojiError("UploadFailed");
		return view;
	};

	const checkName = (
		catalog: EmojiCatalogView,
		name: string,
		except?: string,
	) => {
		if (!NAME_PATTERN.test(name)) throw new EmojiError("InvalidName");
		if (
			catalog.emojis.some((emoji) => emoji.name === name && emoji.id !== except)
		)
			throw new EmojiError("NameTaken");
	};

	const checkPackName = (name: string) => {
		const trimmed = name.trim();
		if (!trimmed || trimmed.length > PACK_NAME_MAX)
			throw new EmojiError("InvalidName");
		return trimmed;
	};

	const membershipsIn = async (provider: EmojiProvider) => {
		const collection = provider.collections.membership;
		if (!collection) return [];
		return (await records.listInRepo(collection)).flatMap((record) => {
			const value = record.value as { subject?: unknown; pack?: unknown };
			return typeof value.subject === "string" && typeof value.pack === "string"
				? [{ uri: record.uri, subject: value.subject, pack: value.pack }]
				: [];
		});
	};

	const dropOwned = async (
		catalog: EmojiCatalogView,
		ids: ReadonlySet<string>,
	) => {
		for (const provider of registry.providers) {
			for (const membership of await membershipsIn(provider)) {
				if (ids.has(membership.subject)) await removeUri(membership.uri);
			}
		}
		for (const id of ids) {
			if (catalog.emojis.some((emoji) => emoji.id === id)) await removeUri(id);
		}
		return {
			...catalog,
			emojis: catalog.emojis.filter((emoji) => !ids.has(emoji.id)),
			packs: catalog.packs.map((pack) => ({
				...pack,
				emojis: pack.emojis.filter((id) => !ids.has(id)),
			})),
		};
	};

	const followTarget = (rkey: string) => ({
		space: space.space,
		collection: colibri.emoji.follow.$nsid,
		rkey,
	});

	const writeMembers = async (
		pack: string,
		provider: ReturnType<typeof packProviderOf>,
		emojis: readonly string[],
	) => {
		const createdAt = now();
		for (const emoji of [...new Set(emojis)]) {
			await put(
				provider.writeMembership({
					owner: viewer,
					rkey: nextTid(),
					emoji,
					pack,
					createdAt,
				}),
			);
		}
	};

	const personal = {
		upload: async (file: File, name: string, providerId?: string) => {
			const catalog = await viewerCatalog();
			checkName(catalog, name);
			const provider = providerOf(providerId ?? DEFAULT_EMOJI_PROVIDER);
			const blob = await records.uploadBlob(file);
			const written = provider.writeItem({
				owner: viewer,
				name,
				image: stored(blob),
				createdAt: now(),
			});
			const { uri, cid } = await put(written);
			const emoji = readBack(written, uri, cid);
			publishViewer({ ...catalog, emojis: [...catalog.emojis, emoji] });
			return emoji;
		},
		rename: async (uri: string, name: string) => {
			const catalog = await viewerCatalog();
			const emoji = catalog.emojis.find((entry) => entry.id === uri);
			if (!emoji) throw new EmojiError("EmojiNotFound");
			checkName(catalog, name, emoji.id);
			const provider = providerOf(emoji.ref.provider);
			const image = bestImage(emoji.images) ?? emoji.images[0];
			const written = provider.writeItem({
				owner: viewer,
				name,
				alt: emoji.alt,
				fallback: emoji.fallback,
				image: {
					cid: image?.cid ?? "",
					mimeType: image?.mimeType ?? "image/png",
					size: image?.size ?? 0,
				},
				createdAt: emoji.createdAt,
			});
			const previous = await records.getInRepo(
				written.collection,
				rkeyOfUri(uri),
			);
			const value = {
				...((previous?.value as Record<string, unknown> | undefined) ?? {}),
				...written.value,
				...(previous?.value
					? { formats: (previous.value as Record<string, unknown>).formats }
					: {}),
			};
			const { uri: next, cid } = await put({ ...written, value });
			if (next !== uri) {
				const memberships = (await membershipsIn(provider)).filter(
					(membership) => membership.subject === uri,
				);
				if (memberships.length > 0) {
					const packs = packProviderOf(provider.id);
					for (const membership of memberships) {
						await put(
							packs.writeMembership({
								owner: viewer,
								rkey: rkeyOfUri(membership.uri),
								emoji: next,
								pack: membership.pack,
								createdAt: now(),
							}),
						);
					}
				}
				await removeUri(uri);
			}
			const renamed = readBack({ ...written, value }, next, cid);
			publishViewer({
				...catalog,
				emojis: catalog.emojis.map((entry) =>
					entry.id === uri ? renamed : entry,
				),
				packs: catalog.packs.map((pack) => ({
					...pack,
					emojis: pack.emojis.map((id) => (id === uri ? next : id)),
				})),
			});
			return renamed;
		},
		remove: async (uri: string) => {
			const catalog = await viewerCatalog();
			publishViewer(await dropOwned(catalog, new Set([uri])));
		},
		createPack: async (name: string, emojis: string[]) => {
			const catalog = await viewerCatalog();
			const provider = packProviderOf(DEFAULT_EMOJI_PROVIDER);
			const createdAt = now();
			const packName = checkPackName(name);
			const written = provider.writePack({
				owner: viewer,
				rkey: nextTid(),
				name: packName,
				createdAt,
			});
			const { uri } = await put(written);
			const known = new Set(catalog.emojis.map((emoji) => emoji.id));
			const members = [...new Set(emojis)].filter((id) => known.has(id));
			await writeMembers(uri, provider, members);
			const pack: EmojiPackView = {
				id: uri,
				provider: provider.provider.id,
				name: packName,
				emojis: members,
				createdAt,
			};
			publishViewer({ ...catalog, packs: [...catalog.packs, pack] });
			return pack;
		},
		updatePack: async (uri: string, name?: string, emojis?: string[]) => {
			const catalog = await viewerCatalog();
			const pack = catalog.packs.find((entry) => entry.id === uri);
			if (!pack) throw new EmojiError("PackNotFound");
			const provider = packProviderOf(pack.provider);
			let next = pack;
			if (name !== undefined) {
				const packName = checkPackName(name);
				await put(
					provider.writePack({
						owner: viewer,
						rkey: rkeyOfUri(uri),
						name: packName,
						description: pack.description,
						createdAt: pack.createdAt,
					}),
				);
				next = { ...next, name: packName };
			}
			if (emojis !== undefined) {
				for (const membership of await membershipsIn(provider.provider)) {
					if (membership.pack === uri) await removeUri(membership.uri);
				}
				const known = new Set(catalog.emojis.map((emoji) => emoji.id));
				const members = [...new Set(emojis)].filter((id) => known.has(id));
				await writeMembers(uri, provider, members);
				next = { ...next, emojis: members };
			}
			publishViewer({
				...catalog,
				packs: catalog.packs.map((entry) => (entry.id === uri ? next : entry)),
			});
			return next;
		},
		removePack: async (uri: string) => {
			const catalog = await viewerCatalog();
			const pack = catalog.packs.find((entry) => entry.id === uri);
			if (!pack) throw new EmojiError("PackNotFound");
			const provider = providerOf(pack.provider);
			for (const membership of await membershipsIn(provider)) {
				if (membership.pack === uri) await removeUri(membership.uri);
			}
			await removeUri(uri);
			publishViewer({
				...catalog,
				packs: catalog.packs.filter((entry) => entry.id !== uri),
			});
		},
	};

	const community = {
		upload: async (
			target: Did,
			file: File,
			name: string,
			pack?: string,
			provider?: string,
		) => {
			const result = await transport.procedure(colibri.emoji.upload.main, {
				params: { community: target, name, pack, provider },
				raw: { data: file, encoding: file.type || "image/png" },
			});
			const emoji = emojiFromWire(result.emoji as WireEmoji, locate);
			if (!emoji) throw new EmojiError("UploadFailed");
			return emoji;
		},
	};

	return {
		observe: (event) => {
			if (event.$type === "emojiEvent" && event.catalog.community === viewer)
				own = event.catalog;
			if (event.$type === "emojiLibraryEvent") own = event.library.own;
		},
		listEmoji: (owner) =>
			call(colibri.emoji.getCatalog.main.nsid, () => fetchCatalog(owner)),
		uploadEmoji: (upload) =>
			call(colibri.emoji.upload.main.nsid, () =>
				upload.community === viewer
					? personal.upload(upload.file, upload.name, upload.provider)
					: community.upload(
							upload.community,
							upload.file,
							upload.name,
							upload.pack,
							upload.provider,
						),
			),
		renameEmoji: (rename) =>
			call(colibri.emoji.rename.main.nsid, async () => {
				if (rename.community === viewer)
					return personal.rename(rename.emoji, rename.name);
				const result = await transport.procedure(colibri.emoji.rename.main, {
					body: rename,
				});
				const emoji = emojiFromWire(result.emoji as WireEmoji, locate);
				if (!emoji) throw new EmojiError("EmojiNotFound");
				return emoji;
			}),
		deleteEmoji: (target) =>
			call(colibri.emoji.delete.main.nsid, async () => {
				if (target.community === viewer) return personal.remove(target.emoji);
				await transport.procedure(colibri.emoji.delete.main, { body: target });
			}),
		createEmojiPack: (pack) =>
			call(colibri.emoji.createPack.main.nsid, async () => {
				if (pack.community === viewer)
					return personal.createPack(pack.name, pack.emojis);
				const result = await transport.procedure(
					colibri.emoji.createPack.main,
					{
						body: pack,
					},
				);
				return packFromWire(result.pack as WirePack);
			}),
		updateEmojiPack: (pack) =>
			call(colibri.emoji.updatePack.main.nsid, async () => {
				if (pack.community === viewer)
					return personal.updatePack(pack.pack, pack.name, pack.emojis);
				const result = await transport.procedure(
					colibri.emoji.updatePack.main,
					{
						body: pack,
					},
				);
				return packFromWire(result.pack as WirePack);
			}),
		deleteEmojiPack: (pack) =>
			call(colibri.emoji.deletePack.main.nsid, async () => {
				if (pack.community === viewer) return personal.removePack(pack.pack);
				await transport.procedure(colibri.emoji.deletePack.main, {
					body: pack,
				});
			}),
		getEmojiLibrary: () =>
			call(colibri.emoji.getLibrary.main.nsid, async () => {
				const result = await transport.query(colibri.emoji.getLibrary.main);
				const library = libraryFromWire(result.library as WireLibrary, locate);
				own = library.own;
				return library;
			}),
		followEmoji: ({ subject }) =>
			call(colibri.emoji.putFollow.main.nsid, async () => {
				const rkey = nextTid();
				const createdAt = now();
				await space.write(() =>
					records.putInSpace(followTarget(rkey), { subject, createdAt }),
				);
				try {
					const result = await transport.procedure(
						colibri.emoji.putFollow.main,
						{ body: { rkey, subject, createdAt } },
					);
					if (!result.follow) throw new EmojiError("EmojiNotFound");
					return followFromWire(result.follow as WireFollow, locate);
				} catch (error) {
					await records.deleteInSpace(followTarget(rkey)).catch(() => {});
					throw error;
				}
			}),
		unfollowEmoji: ({ rkey }) =>
			call(colibri.emoji.putFollow.main.nsid, async () => {
				await records.deleteInSpace(followTarget(rkey));
				await transport.procedure(colibri.emoji.putFollow.main, {
					body: { rkey },
				});
			}),
	};
};
