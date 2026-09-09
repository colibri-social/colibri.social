import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import {
	asCid,
	asDatetime,
	asDid,
	asRecordKey,
	asSpaceRef,
	COLLECTIONS,
} from "./lexicons";
import { buildMessageRecord } from "./message-record";
import { enqueueSpaceCreate } from "./outbox/outbox";
import { enqueueMessageSend } from "./outbox/sends";
import { nextTid } from "./outbox/tid";
import { parseSpace } from "./space-ref";
import type {
	AttachmentView,
	ForwardSnapshot,
	MessageView,
	SpaceRecordRef,
} from "./views";

const log = createLogger("forward");

export type ForwardPlan = {
	snapshot: ForwardSnapshot;
	attachments: ReadonlyArray<AttachmentView>;
};

export type ForwardResult =
	| { ok: true; sent: number }
	| { ok: false; reason: "download" }
	| { ok: false; reason: "partial"; sent: number; total: number };

export const isForwardable = (message: MessageView): boolean =>
	parseSpace(message.channel) !== undefined;

export const forwardSourceOf = (message: MessageView): SpaceRecordRef => ({
	space: asSpaceRef(message.channel),
	did: asDid(message.author.did),
	rkey: asRecordKey(message.rkey),
});

export const planForward = (message: MessageView): ForwardPlan => {
	const carried = message.forward;

	if (carried) {
		return {
			snapshot: {
				source: {
					space: asSpaceRef(carried.source.space),
					did: asDid(carried.source.did),
					rkey: asRecordKey(carried.source.rkey),
					...(carried.source.cid ? { cid: asCid(carried.source.cid) } : {}),
				},
				createdAt: asDatetime(carried.createdAt),
				text: carried.text,
				...(carried.facets && carried.facets.length > 0
					? { facets: [...carried.facets] }
					: {}),
			},
			attachments: carried.attachments,
		};
	}

	return {
		snapshot: {
			source: forwardSourceOf(message),
			createdAt: asDatetime(message.createdAt),
			text: message.text,
			...(message.facets && message.facets.length > 0
				? { facets: [...message.facets] }
				: {}),
		},
		attachments: message.attachments,
	};
};

const fileNameFor = (attachment: AttachmentView, index: number): string => {
	if (attachment.name) return attachment.name;
	const extension = attachment.mimeType.split("/")[1];
	return extension
		? `attachment-${index + 1}.${extension}`
		: `attachment-${index + 1}`;
};

const download = async (
	attachments: ReadonlyArray<AttachmentView>,
): Promise<File[] | undefined> => {
	try {
		return await Promise.all(
			attachments.map(async (attachment, index) => {
				const response = await fetch(attachment.url);
				if (!response.ok) throw new Error(`status ${response.status}`);
				const body = await response.blob();
				return new File([body], fileNameFor(attachment, index), {
					type: attachment.mimeType || body.type,
				});
			}),
		);
	} catch (err) {
		log.error("could not re-download a forwarded attachment", {
			code: classifyThrown(err, { method: "forward.download" }).code,
		});
		return undefined;
	}
};

const queueOne = async (input: {
	plan: ForwardPlan;
	space: string;
	repo: string;
	comment: string;
	files: ReadonlyArray<File>;
}): Promise<boolean> => {
	if (input.files.length > 0) {
		const queued = await enqueueMessageSend({
			space: input.space,
			repo: input.repo,
			text: input.comment,
			facets: [],
			files: input.files,
			suppressedEmbeds: [],
			forward: input.plan.snapshot,
		});
		if (!queued.ok) {
			log.error("could not queue a forward with attachments", {
				code: queued.reason,
			});
		}
		return queued.ok;
	}

	const record = buildMessageRecord({
		text: input.comment,
		createdAt: new Date().toISOString(),
		forward: input.plan.snapshot,
	});

	try {
		await enqueueSpaceCreate(
			input.space,
			input.repo,
			COLLECTIONS.message,
			record,
			{ rkey: nextTid(), label: "Failed to forward message." },
		);
		return true;
	} catch (err) {
		log.error("could not queue a forward", {
			code: classifyThrown(err, { method: "forward.enqueue" }).code,
		});
		return false;
	}
};

export const sendForward = async (input: {
	plan: ForwardPlan;
	spaces: ReadonlyArray<string>;
	repo: string;
	comment: string;
}): Promise<ForwardResult> => {
	let files: ReadonlyArray<File> = [];
	if (input.plan.attachments.length > 0) {
		const downloaded = await download(input.plan.attachments);
		if (!downloaded) return { ok: false, reason: "download" };
		files = downloaded;
	}

	let sent = 0;
	for (const space of input.spaces) {
		const queued = await queueOne({
			plan: input.plan,
			space,
			repo: input.repo,
			comment: input.comment,
			files,
		});
		if (queued) sent += 1;
	}

	if (sent === input.spaces.length) return { ok: true, sent };
	return { ok: false, reason: "partial", sent, total: input.spaces.length };
};
