import type { ColibriRichTextFacet } from "@colibri-social/lib";

type Feature = ColibriRichTextFacet["features"][number];

export const stableStringify = (value: unknown): string => {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}

	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys
		.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
		.join(",")}}`;
};

export const buildFeatureKey = (feature: Feature): string => {
	switch (feature.$type) {
		case "social.colibri.beta.richtext.facet#mention":
			return `${feature.$type}:${"did" in feature ? feature.did : ""}`;
		case "social.colibri.beta.richtext.facet#channel":
			return `${feature.$type}:${"channel" in feature ? feature.channel : ""}`;
		case "social.colibri.beta.richtext.facet#role":
			return `${feature.$type}:${"role" in feature ? feature.role : ""}`;
		case "social.colibri.beta.richtext.facet#link":
			return `${feature.$type}:${"uri" in feature ? feature.uri : ""}`;
		case "social.colibri.beta.richtext.facet#codeblock":
			return `${feature.$type}:${"lang" in feature ? (feature.lang ?? "") : ""}`;
		case "social.colibri.beta.richtext.facet#time":
			return `${feature.$type}:${"datetime" in feature ? feature.datetime : ""}`;
		case "social.colibri.beta.richtext.facet#heading":
			return `${feature.$type}:${"level" in feature ? feature.level : ""}`;
		case "social.colibri.beta.richtext.facet#list": {
			const ordered = "ordered" in feature ? feature.ordered : "";
			const indent = "indent" in feature ? (feature.indent ?? 0) : 0;
			return `${feature.$type}:${ordered}:${indent}`;
		}
		case "social.colibri.beta.richtext.facet#bold":
		case "social.colibri.beta.richtext.facet#italic":
		case "social.colibri.beta.richtext.facet#underline":
		case "social.colibri.beta.richtext.facet#strikethrough":
		case "social.colibri.beta.richtext.facet#code":
		case "social.colibri.beta.richtext.facet#quote":
		case "social.colibri.beta.richtext.facet#subtext":
		case "social.colibri.beta.richtext.facet#spoiler":
			return feature.$type;
		default:
			return `${feature.$type}:${stableStringify(feature)}`;
	}
};

const QUOTE_TYPE = "social.colibri.beta.richtext.facet#quote";

const hasQuote = (facet: ColibriRichTextFacet): boolean =>
	facet.features.some((f) => f.$type === QUOTE_TYPE);

/**
 * Groups facets sharing a byte range and merges their features. A quote is
 * kept in its own group so that a same-range heading, list, subtext or
 * codeblock stays a separate facet and can be nested inside it.
 */
export const normalizeFacets = (
	facets: Array<ColibriRichTextFacet>,
): Array<ColibriRichTextFacet> => {
	if (!facets.length) return [];

	const grouped = new Map<
		string,
		{
			byteStart: number;
			byteEnd: number;
			features: Feature[];
			firstFacet: ColibriRichTextFacet;
			featureKeys: Set<string>;
		}
	>();

	for (const facet of facets) {
		if (facet.index.byteEnd <= facet.index.byteStart) continue;

		const key = `${facet.index.byteStart}:${facet.index.byteEnd}:${hasQuote(facet)}`;
		let entry = grouped.get(key);

		if (!entry) {
			entry = {
				byteStart: facet.index.byteStart,
				byteEnd: facet.index.byteEnd,
				features: [],
				firstFacet: facet,
				featureKeys: new Set(),
			};
			grouped.set(key, entry);
		}

		for (const feature of facet.features) {
			const featureKey = buildFeatureKey(feature);
			if (entry.featureKeys.has(featureKey)) continue;
			entry.featureKeys.add(featureKey);
			entry.features.push(feature);
		}
	}

	return [...grouped.values()]
		.map((entry) => ({
			$type: entry.firstFacet.$type ?? "social.colibri.beta.richtext.facet",
			index: {
				...entry.firstFacet.index,
				byteStart: entry.byteStart,
				byteEnd: entry.byteEnd,
			},
			features: entry.features,
		}))
		.sort((a, b) => {
			if (a.index.byteStart !== b.index.byteStart) {
				return a.index.byteStart - b.index.byteStart;
			}
			return a.index.byteEnd - b.index.byteEnd;
		});
};
