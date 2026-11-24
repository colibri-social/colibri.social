import {
	canonicalSpaceUri,
	canonicalSpaceUris,
	legacySpaceUri,
	mapSpaceUris,
} from "./space-ref.js";

export const LEGACY_SPACE_URIS_FEATURE = "legacySpaceUris";
export const LEGACY_SPACE_URIS_STORAGE_KEY = "colibri:legacy-space-uris";

type SafeParse = (input: unknown) => { success: boolean; value?: unknown };

let legacy = true;

export const legacySpaceUrisEnabled = () => {
	return legacy;
};

export const setLegacySpaceUris = (enabled: boolean) => {
	legacy = enabled;
};

export const legacySpaceUrisFromFeatures = (
	features: ReadonlyArray<string> | undefined,
) => {
	return features?.includes(LEGACY_SPACE_URIS_FEATURE) ?? false;
};

export const outgoingSpaceUris = <T>(value: T): T => {
	return mapSpaceUris(value, legacy ? legacySpaceUri : canonicalSpaceUri) as T;
};

export const lexSpaceUri = (uri: string) => {
	return legacySpaceUri(uri);
};

export const lexSpaceUris = <T>(value: T): T => {
	return mapSpaceUris(value, legacySpaceUri) as T;
};

export const safeParseSpaceUris = <T>(
	parse: SafeParse,
	input: unknown,
): { success: true; value: T } | { success: false } => {
	const result = parse(lexSpaceUris(input));
	if (!result.success) return { success: false };

	return { success: true, value: canonicalSpaceUris(result.value) as T };
};
