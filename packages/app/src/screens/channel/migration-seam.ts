import type { MigrationInfo } from "../../data/types";
import type { ChatMessage } from "./message/types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

export const migrationSeamLabel = (
	migration: MigrationInfo,
	handle?: string,
): string => {
	const at = new Date(migration.at);
	const when = Number.isNaN(at.getTime())
		? ""
		: ` on ${DATE_FORMAT.format(at)}`;
	const who = handle ? ` by @${handle}` : "";
	return `Moved to Spaces${who}${when}. Messages above are read-only.`;
};

export const lastLegacyKey = (
	items: readonly ChatMessage[],
): string | undefined => {
	let last: string | undefined;
	for (const item of items) {
		if (item.view?.legacy) last = item.key;
	}
	return last;
};
