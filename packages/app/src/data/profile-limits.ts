const encoder = new TextEncoder();

const utf8Length = (text: string) => encoder.encode(text).length;

export const DISPLAY_NAME_MAX_GRAPHEMES = 64;
export const DISPLAY_NAME_MAX_BYTES = 640;
export const BIO_MAX_GRAPHEMES = 256;
export const BIO_MAX_BYTES = 2560;

const segmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: undefined;

export const graphemeLength = (text: string) =>
	segmenter
		? Array.from(segmenter.segment(text)).length
		: Array.from(text).length;

export const displayNameError = (value: string) => {
	const name = value.trim();
	if (!name) return "Enter a display name.";
	if (
		graphemeLength(name) > DISPLAY_NAME_MAX_GRAPHEMES ||
		utf8Length(name) > DISPLAY_NAME_MAX_BYTES
	) {
		return `Keep it under ${DISPLAY_NAME_MAX_GRAPHEMES} characters.`;
	}
	return undefined;
};

export const bioError = (value: string) => {
	const bio = value.trim();
	if (
		graphemeLength(bio) > BIO_MAX_GRAPHEMES ||
		utf8Length(bio) > BIO_MAX_BYTES
	) {
		return `Keep your bio under ${BIO_MAX_GRAPHEMES} characters.`;
	}
	return undefined;
};

export const PRONOUNS_MAX_GRAPHEMES = 64;
export const PRONOUNS_MAX_BYTES = 640;

export const pronounsError = (value: string) => {
	const pronouns = value.trim();
	if (
		graphemeLength(pronouns) > PRONOUNS_MAX_GRAPHEMES ||
		utf8Length(pronouns) > PRONOUNS_MAX_BYTES
	) {
		return `Keep your pronouns under ${PRONOUNS_MAX_GRAPHEMES} characters.`;
	}
	return undefined;
};
