export const STATUS_TEXT_MAX_BYTES = 64;

const encoder = new TextEncoder();

export const utf8Length = (text: string) => encoder.encode(text).length;

const graphemes = (text: string): string[] => {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(text), (part) => part.segment);
	}
	return Array.from(text);
};

export const clampToBytes = (text: string, maxBytes: number) => {
	if (utf8Length(text) <= maxBytes) return text;
	let kept = "";
	let used = 0;
	for (const grapheme of graphemes(text)) {
		const size = utf8Length(grapheme);
		if (used + size > maxBytes) break;
		kept += grapheme;
		used += size;
	}
	return kept;
};

export const clampStatusText = (text: string) =>
	clampToBytes(text, STATUS_TEXT_MAX_BYTES);
