import { LABEL_VALUES } from "./lexicons";
import type { LabelView, MessageView } from "./views";

export const HIDDEN = LABEL_VALUES.hidden;

export const SPOILER = LABEL_VALUES.spoiler;

export const EMBEDS_SUPPRESSED = LABEL_VALUES.embedsSuppressed;

export type EmbedSuppression = {
	all: boolean;
	uris: Set<string>;
};

const labelsWith = (
	labels: ReadonlyArray<LabelView>,
	val: string,
): Array<LabelView> => labels.filter((label) => label.val === val);

export const hasLabel = (message: MessageView, val: string): boolean =>
	message.labels.some((label) => label.val === val);

export const isHidden = (message: MessageView): boolean =>
	hasLabel(message, HIDDEN);

export const isSpoilered = (message: MessageView): boolean =>
	hasLabel(message, SPOILER);

export const embedSuppression = (message: MessageView): EmbedSuppression => {
	const uris = new Set(message.suppressedEmbeds ?? []);
	let all = false;

	for (const label of labelsWith(message.labels, EMBEDS_SUPPRESSED)) {
		if (label.scope === undefined || label.scope.length === 0) {
			all = true;
			continue;
		}
		for (const uri of label.scope) uris.add(uri);
	}

	return { all, uris };
};

export const isEmbedSuppressed = (
	suppression: EmbedSuppression,
	uri: string,
): boolean => suppression.all || suppression.uris.has(uri);
