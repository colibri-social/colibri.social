import type {
	ColibriRichTextFacet,
	ColibriRichTextLink,
} from "@colibri-social/lib";

export const linkUrisFromFacets = (
	facets: Array<ColibriRichTextFacet> | undefined,
): Array<string> =>
	facets
		?.filter(
			(f) => f.features[0].$type === "social.colibri.richtext.facet#link",
		)
		.map((f) => (f.features[0] as ColibriRichTextLink).uri) ?? [];
