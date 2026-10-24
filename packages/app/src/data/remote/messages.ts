import {
	buildMessageRecord,
	ColibriError,
	colibri,
	createLogger,
	nextTid,
	spaceAuthority,
	spaceRecordUri,
	spaceSkey,
} from "@colibri-social/lib";
import { measureMedia } from "../media-size";
import type {
	EmbedSuppressionInput,
	ForwardInput,
	LiveEvent,
	ReactInput,
	SendMessageInput,
} from "../source";
import { MAX_ATTACHMENT_BYTES, MESSAGE_COLLECTION } from "../source";
import {
	type AttachmentView,
	type Datetime,
	type Did,
	EMBEDS_SUPPRESSED_LABEL,
	type Facet,
	type MessageView,
	type ProfileView,
	type SpaceRef,
} from "../types";
import type { BlobRef, Records } from "./records";
import type { Transport } from "./transport";

const log = createLogger("remote/messages");

export const REACTION_COLLECTION = "social.colibri.beta.reaction";
const HIDDEN_LABEL = "hidden";

type Label = MessageView["labels"][number];
type Attached = {
	blob: BlobRef;
	name?: string;
	width?: number;
	height?: number;
	spoiler?: boolean;
	alt?: string;
};

const keyOf = (channel: string, rkey: string) => `${channel}\n${rkey}`;

const messageNotFound = (method: string) =>
	new ColibriError({ code: "MessageNotFound", method });

export const createMessageIndex = () => {
	const messages = new Map<string, MessageView>();
	const latest = new Map<string, string>();
	const homes = new Map<string, Set<string>>();

	const put = (message: MessageView) => {
		messages.set(keyOf(message.channel, message.rkey), message);
		const known = homes.get(message.rkey);
		if (known) known.add(message.channel);
		else homes.set(message.rkey, new Set([message.channel]));
		const current = latest.get(message.channel);
		if (!current || message.rkey > current)
			latest.set(message.channel, message.rkey);
	};

	const forget = (channel: string, rkey: string) => {
		messages.delete(keyOf(channel, rkey));
		const known = homes.get(rkey);
		known?.delete(channel);
		if (known?.size === 0) homes.delete(rkey);
	};

	const find = (channel: string, rkey: string) => {
		const direct = messages.get(keyOf(channel, rkey));
		if (direct) return direct;
		for (const home of homes.get(rkey) ?? []) {
			const found = messages.get(keyOf(home, rkey));
			if (found) return found;
		}
		return undefined;
	};

	return {
		put,
		get: (channel: string, rkey: string) => messages.get(keyOf(channel, rkey)),
		find,
		remove: (channel: string, rkey: string) => {
			forget(channel, rkey);
			if (latest.get(channel) === rkey) latest.delete(channel);
		},
		latest: (channel: string) => latest.get(channel),
		observe: (event: LiveEvent) => {
			if (event.$type !== "messageEvent") return;
			if (event.event === "delete" && event.rkey) {
				forget(event.channel, event.rkey);
				return;
			}
			if (event.message) put(event.message);
		},
	};
};

export type MessageIndex = ReturnType<typeof createMessageIndex>;

export const createUploads = () => {
	const byUrl = new Map<string, Attached>();
	return {
		remember: (url: string, attached: Attached) => byUrl.set(url, attached),
		resolve: (attachments: readonly AttachmentView[] | undefined) =>
			(attachments ?? []).map((attachment) => {
				const known = byUrl.get(attachment.url);
				if (!known)
					throw new ColibriError({
						code: "UploadFailed",
						method: "message.attachments",
					});
				return {
					...known,
					...(attachment.spoiler ? { spoiler: true } : {}),
					...(attachment.alt ? { alt: attachment.alt } : {}),
				};
			}),
		blobFor: (url: string) => byUrl.get(url)?.blob,
	};
};

export type Uploads = ReturnType<typeof createUploads>;

export const createMessageWrites = (deps: {
	transport: Transport;
	records: Records;
	index: MessageIndex;
	uploads: Uploads;
	viewer: () => ProfileView;
}) => {
	const { transport, records, index, uploads } = deps;
	const reactionKeys = new Map<string, string>();

	const require = (channel: string, rkey: string, method: string) => {
		const message = index.find(channel, rkey);
		if (!message) throw messageNotFound(method);
		return message;
	};

	const patch = (message: MessageView, next: Partial<MessageView>) => {
		const merged = { ...message, ...next } as MessageView;
		index.put(merged);
		return merged;
	};

	const viewOf = (input: {
		channel: SpaceRef;
		rkey: string;
		text: string;
		facets?: Facet[];
		createdAt: string;
		attachments?: AttachmentView[];
		parent?: MessageView;
		forward?: MessageView["forward"];
	}): MessageView => {
		const author = deps.viewer();
		const view: MessageView = {
			uri: (spaceRecordUri(
				input.channel,
				author.did,
				MESSAGE_COLLECTION,
				input.rkey,
			) ??
				`at://${author.did}/${MESSAGE_COLLECTION}/${input.rkey}`) as MessageView["uri"],
			rkey: input.rkey,
			channel: input.channel,
			author,
			text: input.text,
			createdAt: input.createdAt as Datetime,
			attachments: input.attachments ?? [],
			reactions: [],
			labels: [],
		};
		if (input.facets?.length) view.facets = input.facets;
		if (input.forward) view.forward = input.forward;
		if (input.parent) {
			const { parent: _nested, ...rest } = input.parent;
			view.parent = {
				...rest,
				$type: "social.colibri.beta.channel.defs#messageView",
			} as never;
		}
		return view;
	};

	const readOwn = async (channel: SpaceRef, rkey: string) => {
		const stored = await records.getInSpace({
			space: channel,
			collection: MESSAGE_COLLECTION,
			rkey,
		});
		return (stored.value ?? {}) as Record<string, unknown>;
	};

	const label = async (
		message: MessageView,
		val: string,
		scope?: string[],
	): Promise<Label> => {
		const result = await transport.procedure(
			colibri.community.applyLabel.main,
			{
				body: {
					space: message.channel,
					subject: {
						did: message.author.did,
						collection: MESSAGE_COLLECTION,
						rkey: message.rkey,
					},
					val,
					...(scope ? { scope } : {}),
				},
			},
		);
		return result.label as Label;
	};

	const unlabel = async (message: MessageView, val: string) => {
		try {
			await transport.procedure(colibri.community.negateLabel.main, {
				body: {
					space: message.channel,
					subject: {
						did: message.author.did,
						collection: MESSAGE_COLLECTION,
						rkey: message.rkey,
					},
					val,
				},
			});
		} catch (error) {
			if (error instanceof ColibriError && error.code === "LabelNotFound")
				return;
			throw error;
		}
	};

	const download = async (attachment: AttachmentView, position: number) => {
		const response = await fetch(attachment.url);
		if (!response.ok)
			throw new ColibriError({
				code: "UploadFailed",
				method: "forward.download",
				status: response.status,
			});
		const body = await response.blob();
		const name = attachment.name ?? `attachment-${position + 1}`;
		return new File([body], name, {
			type: attachment.mimeType || body.type,
		});
	};

	return {
		uploadBlob: async (
			file: File,
			options?: {
				onProgress?: (fraction: number) => void;
				signal?: AbortSignal;
			},
		): Promise<AttachmentView> => {
			if (file.size > MAX_ATTACHMENT_BYTES)
				throw new ColibriError({
					code: "FileTooLarge",
					method: "repo.uploadBlob",
				});
			options?.onProgress?.(0);
			const blob = await records.uploadBlob(file, options?.signal);
			options?.onProgress?.(1);
			const url = URL.createObjectURL(file);
			const mimeType = blob.mimeType || file.type;
			const dimensions = await measureMedia(file, url, mimeType);
			uploads.remember(url, { blob, name: file.name, ...dimensions });
			return {
				url: url as AttachmentView["url"],
				name: file.name,
				mimeType,
				size: blob.size ?? file.size,
				...dimensions,
			};
		},

		sendMessage: async (input: SendMessageInput) => {
			const rkey = input.rkey ?? nextTid();
			const createdAt = new Date().toISOString();
			const parent = input.parent
				? index.get(input.channel, input.parent)
				: undefined;
			const parentAuthor = parent?.author.did ?? input.parentAuthor;
			if (input.parent && !parentAuthor)
				throw messageNotFound("message.parent");
			const attached = uploads.resolve(input.attachments);
			const record = buildMessageRecord({
				text: input.text,
				facets: input.facets as never,
				createdAt,
				parent:
					input.parent && parentAuthor
						? ({ did: parentAuthor, rkey: input.parent } as never)
						: undefined,
				attachments: attached as never,
				suppressedEmbeds: input.suppressedEmbeds as never,
			});
			await records.createInSpace(
				{ space: input.channel, collection: MESSAGE_COLLECTION, rkey },
				record as unknown as Record<string, unknown>,
			);
			const view = viewOf({
				channel: input.channel,
				rkey,
				text: input.text,
				facets: input.facets,
				createdAt,
				attachments: input.attachments,
				parent,
			});
			if (input.suppressedEmbeds?.length)
				view.suppressedEmbeds =
					input.suppressedEmbeds as MessageView["suppressedEmbeds"];
			index.put(view);
			return view;
		},

		editMessage: async (input: {
			channel: SpaceRef;
			rkey: string;
			text: string;
			facets?: Facet[];
		}) => {
			const found = index.find(input.channel, input.rkey);
			const space = found?.channel ?? input.channel;
			const current = await readOwn(space, input.rkey);
			const updatedAt = new Date().toISOString();
			const { facets: _facets, ...rest } = current;
			await records.putInSpace(
				{
					space,
					collection: MESSAGE_COLLECTION,
					rkey: input.rkey,
				},
				{
					...rest,
					text: input.text,
					...(input.facets?.length ? { facets: input.facets } : {}),
					updatedAt,
				},
			);
			const known =
				found ??
				viewOf({
					channel: space,
					rkey: input.rkey,
					text: input.text,
					createdAt:
						typeof current.createdAt === "string"
							? current.createdAt
							: updatedAt,
				});
			const next: MessageView = {
				...known,
				text: input.text,
				updatedAt: updatedAt as Datetime,
			};
			if (input.facets?.length) next.facets = input.facets;
			else delete next.facets;
			index.put(next);
			return next;
		},

		deleteMessage: async (input: { channel: SpaceRef; rkey: string }) => {
			const space =
				index.find(input.channel, input.rkey)?.channel ?? input.channel;
			await records.deleteInSpace({
				space,
				collection: MESSAGE_COLLECTION,
				rkey: input.rkey,
			});
			index.remove(space, input.rkey);
		},

		react: async (input: ReactInput) => {
			const known = index.find(input.channel, input.rkey);
			const author = known?.author.did ?? input.author;
			if (!author) throw messageNotFound("message.react");
			const space = known?.channel ?? input.channel;
			const target = { did: author, rkey: input.rkey };
			const cacheKey = `${space}\n${input.rkey}\n${input.emoji}`;
			if (input.add) {
				const rkey = input.reaction ?? nextTid();
				await records.createInSpace(
					{ space, collection: REACTION_COLLECTION, rkey },
					{
						emoji: input.emoji,
						target,
						...(input.customEmoji ? { customEmoji: input.customEmoji } : {}),
					},
				);
				reactionKeys.set(cacheKey, rkey);
				return;
			}
			let rkey = reactionKeys.get(cacheKey) ?? input.reaction;
			if (!rkey) {
				const found = await records.findInSpace(
					{ space, collection: REACTION_COLLECTION },
					(value) => {
						const ref = value.target as
							| { did?: string; rkey?: string }
							| undefined;
						return (
							value.emoji === input.emoji &&
							ref?.did === target.did &&
							ref?.rkey === target.rkey
						);
					},
				);
				rkey = found?.rkey;
			}
			if (!rkey) {
				log.warn("reaction record missing", { method: "reaction.delete" });
				return;
			}
			await records.deleteInSpace({
				space,
				collection: REACTION_COLLECTION,
				rkey,
			});
			reactionKeys.delete(cacheKey);
		},

		setHidden: async (input: {
			channel: SpaceRef;
			rkey: string;
			hidden: boolean;
		}) => {
			const message = require(input.channel, input.rkey, "message.hide");
			const others = message.labels.filter(
				(entry) => entry.val !== HIDDEN_LABEL,
			);
			if (!input.hidden) {
				await unlabel(message, HIDDEN_LABEL);
				return patch(message, { labels: others });
			}
			const applied = await label(message, HIDDEN_LABEL);
			return patch(message, { labels: [...others, applied] });
		},

		setSuppressedEmbeds: async (input: EmbedSuppressionInput) => {
			const message = require(input.channel, input.rkey, "message.embeds");
			const current = await readOwn(message.channel, input.rkey);
			const { suppressedEmbeds: _previous, ...rest } = current;
			await records.putInSpace(
				{
					space: message.channel,
					collection: MESSAGE_COLLECTION,
					rkey: input.rkey,
				},
				input.uris.length > 0
					? { ...rest, suppressedEmbeds: input.uris }
					: rest,
			);
			const next = { ...message } as MessageView;
			if (input.uris.length > 0)
				next.suppressedEmbeds = input.uris as MessageView["suppressedEmbeds"];
			else delete next.suppressedEmbeds;
			index.put(next);
			return next;
		},

		setModeratedEmbeds: async (input: EmbedSuppressionInput) => {
			const message = require(input.channel, input.rkey, "message.embeds");
			const others = message.labels.filter(
				(entry) => entry.val !== EMBEDS_SUPPRESSED_LABEL,
			);
			if (others.length !== message.labels.length)
				await unlabel(message, EMBEDS_SUPPRESSED_LABEL);
			if (input.uris.length === 0) return patch(message, { labels: others });
			const applied = await label(message, EMBEDS_SUPPRESSED_LABEL, input.uris);
			return patch(message, { labels: [...others, applied] });
		},

		forwardMessage: async (input: ForwardInput) => {
			const message =
				index.get(input.from, input.rkey) ??
				input.message ??
				require(input.from, input.rkey, "message.forward");
			const carried = message.forward;
			const snapshot = carried
				? {
						source: carried.source,
						createdAt: carried.createdAt,
						text: carried.text,
						facets: carried.facets,
						attachments: carried.attachments,
					}
				: {
						source: {
							space: input.from,
							did: message.author.did,
							rkey: message.rkey,
						},
						createdAt: message.createdAt,
						text: message.text,
						facets: message.facets,
						attachments: message.attachments,
					};
			const files = await Promise.all(snapshot.attachments.map(download));
			const blobs = await Promise.all(
				files.map(async (file, position): Promise<Attached> => {
					const original = snapshot.attachments[position] as
						| AttachmentView
						| undefined;
					return {
						blob: await records.uploadBlob(file),
						name: file.name,
						...(original?.width && original.height
							? { width: original.width, height: original.height }
							: {}),
						...(original?.spoiler ? { spoiler: true } : {}),
						...(original?.alt ? { alt: original.alt } : {}),
					};
				}),
			);
			const rkey = input.forwardRkey ?? nextTid();
			const createdAt = new Date().toISOString();
			const text = input.text ?? "";
			const facets = input.facets?.length ? input.facets : undefined;
			const record = buildMessageRecord({
				text,
				facets: facets as never,
				createdAt,
				forward: {
					source: snapshot.source,
					createdAt: snapshot.createdAt,
					text: snapshot.text,
					...(snapshot.facets?.length ? { facets: snapshot.facets } : {}),
					attachments: blobs,
				} as never,
			});
			await records.createInSpace(
				{ space: input.to, collection: MESSAGE_COLLECTION, rkey },
				record as unknown as Record<string, unknown>,
			);
			const view = viewOf({
				channel: input.to,
				rkey,
				text,
				facets,
				createdAt,
				forward: {
					source: snapshot.source,
					sourceCommunity: spaceAuthority(input.from) as Did,
					createdAt: snapshot.createdAt,
					text: snapshot.text,
					facets: snapshot.facets,
					attachments: snapshot.attachments,
				} as MessageView["forward"],
			});
			index.put(view);
			return view;
		},

		markRead: async (
			channel: SpaceRef,
			fetchLatest: () => Promise<string | undefined>,
			record: (community: string, channel: string, cursor: string) => void,
			through?: string,
		) => {
			const community = spaceAuthority(channel);
			const skey = spaceSkey(channel);
			if (!community || !skey) return;
			const cursor = through ?? index.latest(channel) ?? (await fetchLatest());
			if (!cursor) return;
			record(community, skey, cursor);
		},
	};
};
