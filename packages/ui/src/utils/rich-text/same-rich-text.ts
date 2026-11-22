import type { RichText } from "../../components/RichEditor/types";

const suppressionKey = (value: RichText) => {
	return JSON.stringify([...new Set(value.suppressedEmbeds ?? [])].sort());
};

export const sameRichText = (a: RichText, b: RichText) => {
	return (
		a.text === b.text &&
		JSON.stringify(a.facets) === JSON.stringify(b.facets) &&
		suppressionKey(a) === suppressionKey(b)
	);
};
