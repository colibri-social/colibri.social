import { NEW_ENTRY } from "../../../shell/layers";

const SEPARATOR = ":";

export const newEntryId = (category?: string) =>
	category ? `${NEW_ENTRY}${SEPARATOR}${category}` : NEW_ENTRY;

export const parseEntryId = (id: string | undefined) => {
	if (id === NEW_ENTRY) return { creating: true as const };
	if (id?.startsWith(`${NEW_ENTRY}${SEPARATOR}`)) {
		return {
			creating: true as const,
			category: id.slice(NEW_ENTRY.length + SEPARATOR.length) || undefined,
		};
	}
	return { creating: false as const, key: id };
};
