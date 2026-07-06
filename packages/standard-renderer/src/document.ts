import type {
	BlockWrapper,
	LeafletContent,
	LinearDocument,
	StandardDocument,
} from "./types.js";

export const isLeafletContent = (
	content: StandardDocument["content"],
): content is LeafletContent =>
	!!content && content.$type === "pub.leaflet.content";

export const getLinearBlocks = (doc: StandardDocument): BlockWrapper[] => {
	const content = doc.content;
	if (!isLeafletContent(content)) return [];

	if (content.blobPages) {
		console.warn(
			"[standard-render] document uses blobPages; inline pages ignored, blob decoding not implemented",
			doc.path,
		);
	}

	const page = content.pages?.find(
		(p: LinearDocument) => p.$type === "pub.leaflet.pages.linearDocument",
	);
	return page?.blocks ?? [];
};
