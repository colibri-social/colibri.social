import { HIDDEN, MOVED } from "../atproto/labels";
import { asDatetime } from "../atproto/lexicons";
import type { LabelEventFrame } from "../atproto/sync-frames";
import type { LabelView, MessageView } from "../atproto/views";

export type LabelFoldResult =
	| { kind: "remove" }
	| { kind: "update"; labels: LabelView[] }
	| { kind: "noop" };

export const foldLabelEvent = (
	message: Pick<MessageView, "author" | "rkey" | "labels">,
	event: LabelEventFrame,
	viewer: { did: string; canApplyLabel: boolean },
	now: () => string,
): LabelFoldResult => {
	if (
		message.author.did !== event.subject.did ||
		message.rkey !== event.subject.rkey
	) {
		return { kind: "noop" };
	}

	const keepsHidden = message.author.did === viewer.did || viewer.canApplyLabel;

	if (event.val === HIDDEN && !keepsHidden) {
		return event.event === "create" ? { kind: "remove" } : { kind: "noop" };
	}

	if (event.val === MOVED && event.event === "create") {
		return { kind: "remove" };
	}

	if (event.event === "create") {
		if (
			message.labels.some((l) => l.val === event.val && l.src === event.src)
		) {
			return { kind: "noop" };
		}
		return {
			kind: "update",
			labels: [
				...message.labels,
				{ src: event.src, val: event.val, createdAt: asDatetime(now()) },
			],
		};
	}

	const next = message.labels.filter(
		(l) => !(l.val === event.val && l.src === event.src),
	);
	if (next.length === message.labels.length) return { kind: "noop" };
	return { kind: "update", labels: next };
};
