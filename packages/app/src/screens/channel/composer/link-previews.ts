import { isGifSiteUrl } from "../../../data/adapters/attachments";
import { linkUris, spoileredLinkUris } from "../../../data/adapters/facets";
import type { Facet } from "../../../data/types";

const DIRECT_MEDIA = /\.(gif|webp|png|jpe?g|avif|bmp)(\?|#|$)/i;

export const isDirectMediaUrl = (uri: string) => {
	try {
		return DIRECT_MEDIA.test(new URL(uri).pathname);
	} catch {
		return false;
	}
};

export const suppressedLinksFor = (
	facets: readonly Facet[] | undefined,
	showPreviews: boolean,
) => {
	if (showPreviews) return [];
	return [...linkUris(facets), ...spoileredLinkUris(facets)].filter(
		(uri) => !isDirectMediaUrl(uri) && !isGifSiteUrl(uri),
	);
};
