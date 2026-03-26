import type { Facet } from "@/utils/atproto/rich-text";

type Feature = Facet["features"][number];

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
		case "social.colibri.richtext.facet#mention":
			return `${feature.$type}:${"did" in feature ? feature.did : ""}`;
		case "social.colibri.richtext.facet#channel":
			return `${feature.$type}:${"channel" in feature ? feature.channel : ""}`;
		case "social.colibri.richtext.facet#link":
			return `${feature.$type}:${"uri" in feature ? feature.uri : ""}`;
		case "social.colibri.richtext.facet#bold":
		case "social.colibri.richtext.facet#italic":
		case "social.colibri.richtext.facet#underline":
		case "social.colibri.richtext.facet#strikethrough":
		case "social.colibri.richtext.facet#code":
			return feature.$type;
		default:
			return `${feature.$type}:${stableStringify(feature)}`;
	}
};

export const normalizeFacets = (facets: Array<Facet>): Array<Facet> => {
	if (!facets.length) return [];

	const grouped = new Map<
		string,
		{
			byteStart: number;
			byteEnd: number;
			features: Feature[];
			firstFacet: Facet;
			featureKeys: Set<string>;
		}
	>();

	for (const facet of facets) {
		const key = `${facet.index.byteStart}:${facet.index.byteEnd}`;
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
			$type: entry.firstFacet.$type ?? "social.colibri.richtext.facet",
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
