import type { Editor } from "@tiptap/core";
import type { TextWithFacets } from "../RichTextRenderer";
import type { Facet } from "@/utils/atproto/rich-text";

export const facetsToProseMirror = (
	text: string,
	facets: Array<Facet>,
): ReturnType<Editor["getJSON"]> => {
	return { type: "doc", attrs: [], content: [] };
};
