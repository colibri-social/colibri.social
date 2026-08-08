import { normalizeAppViewUrl } from "./appview";

const URL_STORAGE_KEY = "colibri:labeler-url";
const DID_STORAGE_KEY = "colibri:labeler-did";

export const DEFAULT_LABELER_URL = "https://labeler.colibri.social";
export const DEFAULT_LABELER_DID = "did:plc:hgxdb52zedcotcvqstj6eob4";

export const getLabelerUrl = (): string => {
	try {
		const raw = localStorage.getItem(URL_STORAGE_KEY);
		if (!raw) return DEFAULT_LABELER_URL;
		return normalizeAppViewUrl(raw) ?? DEFAULT_LABELER_URL;
	} catch {
		return DEFAULT_LABELER_URL;
	}
};

export const getLabelerDid = (): string => {
	try {
		const raw = localStorage.getItem(DID_STORAGE_KEY)?.trim();
		if (!raw?.startsWith("did:")) return DEFAULT_LABELER_DID;
		return raw;
	} catch {
		return DEFAULT_LABELER_DID;
	}
};
