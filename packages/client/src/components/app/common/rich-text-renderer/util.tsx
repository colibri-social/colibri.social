import type { AT_URI, ColibriRichTextFacet } from "@colibri-social/lib";
import { A } from "@solidjs/router";
import twemoji from "@twemoji/api";
import type { JSX } from "solid-js";
import { rewriteBskyUrl } from "../../../../atproto/bsky-post-url";
import { communityUriToUrlCompatible } from "../../../../atproto/community-uri-to-url-compatible";
import { useCommunityContext } from "../../../../contexts/Community";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { AtURI } from "../../../../utils/at-uri";
import { CodeBlock } from "./CodeBlock";
import { Timestamp } from "./Timestamp";
import {
	buildFeatureKey,
	normalizeFacets,
} from "../../../../utils/normalize-facets";
import { purify } from "../../../../utils/purify";
import User from "../../user";

export type TextWithFacets = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
};

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export type AnyFeature = ColibriRichTextFacet["features"][number];

/**
 * Convert newline characters to `<br>` tags for HTML output.
 */
const nlToBr = (s: string): string => s.replace(/\n/g, "<br>");

/**
 * Escape a string for safe use inside an HTML attribute value.
 */
const escapeAttr = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Wraps the facet's text content in the appropriate HTML element, embedding
 * `data-facet-type` (and any metadata like `data-did`, `data-uri`,
 * `data-channel`) so the reverse parser can reconstruct the facet losslessly.
 */
const applyStyleForFacet = (text: string, feature: AnyFeature): JSX.Element => {
	const community = useCommunityContext();
	const { preferences } = useUserPreferences();

	const textWithEmojis = twemoji.parse(purify(text));

	switch (feature.$type) {
		case "social.colibri.richtext.facet#mention": {
			const did = "did" in feature ? escapeAttr(String(feature.did)) : "";

			const member = community().members.find((x) => x.did === did);

			if (!member) {
				return (
					<span
						data-facet-type="mention"
						data-did={did}
						class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline"
						innerHTML={textWithEmojis}
					/>
				);
			}

			return (
				<User.ProfilePopover user={member} as="span" class="inline">
					<span
						data-facet-type="mention"
						data-did={did}
						class="bg-primary/25 hover:bg-primary/35 px-1 rounded-xs cursor-pointer inline"
						innerHTML={textWithEmojis}
					/>
				</User.ProfilePopover>
			);
		}
		case "social.colibri.richtext.facet#link": {
			const rawUri = "uri" in feature ? String(feature.uri) : text;
			const displayHref = () =>
				rewriteBskyUrl(rawUri, preferences().preferredBlueskyClient);
			const isBareUrl = text.trim() === rawUri;
			return (
				// biome-ignore lint/a11y/useAnchorContent: This has innerHTML set.
				<a
					data-facet-type="link"
					title={displayHref()}
					data-uri={escapeAttr(rawUri)}
					href={displayHref()}
					class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline w-fit"
					target="_blank"
					rel="noreferrer"
					innerHTML={
						isBareUrl ? twemoji.parse(purify(displayHref())) : textWithEmojis
					}
				/>
			);
		}
		case "social.colibri.richtext.facet#channel": {
			const channel =
				"channel" in feature ? escapeAttr(String(feature.channel)) : "";

			const c = community();
			const channelData = c.channels.find((c) => c.uri === channel);

			if (channelData) {
				const href = escapeAttr(
					`/app/c/${communityUriToUrlCompatible(c.community.uri as AT_URI<"social.colibri.community">)}/${channelData.type}/${new AtURI(channelData.uri).identifier}`,
				);
				return (
					<A
						data-facet-type="channel"
						data-channel={channel}
						href={href}
						class="bg-blue-500/25 hover:bg-blue-500/35 px-1 rounded-xs cursor-pointer inline no-underline text-foreground"
						innerHTML={textWithEmojis}
					/>
				);
			}

			return (
				<div
					data-facet-type="channel"
					data-channel={channel}
					class="bg-blue-500/25 px-1 rounded-xs inline"
					innerHTML={textWithEmojis}
				/>
			);
		}
		case "social.colibri.richtext.facet#bold":
			return (
				<b
					data-facet-type="bold"
					class="font-bold"
					innerHTML={textWithEmojis}
				/>
			);
		case "social.colibri.richtext.facet#italic":
			return (
				<i data-facet-type="italic" class="italic" innerHTML={textWithEmojis} />
			);
		case "social.colibri.richtext.facet#underline":
			return (
				<u
					data-facet-type="underline"
					class="underline"
					innerHTML={textWithEmojis}
				/>
			);
		case "social.colibri.richtext.facet#strikethrough":
			return (
				<span
					data-facet-type="strikethrough"
					class="line-through"
					innerHTML={textWithEmojis}
				/>
			);
		case "social.colibri.richtext.facet#code":
			return <code data-facet-type="code" innerHTML={textWithEmojis} />;
		case "social.colibri.richtext.facet#time": {
			const datetime = "datetime" in feature ? String(feature.datetime) : "";
			const style = "style" in feature ? feature.style : undefined;
			return <Timestamp datetime={datetime} style={style} />;
		}
	}

	// Reached for codeblock/quote, which are rendered as block-level wrappers
	// by the caller instead of through this inline-feature switch.
	return `[UNKNOWN FACET: ${feature.$type}]`;
};

const isBlockFeature = (feature: AnyFeature): boolean =>
	feature.$type === "social.colibri.richtext.facet#codeblock" ||
	feature.$type === "social.colibri.richtext.facet#quote";

/**
 * Renders a byte range of inline content (text/marks/mentions/links/time),
 * walking through sorted, non-overlapping segments within that range.
 * Codeblock/quote facets are excluded here — they're rendered as block-level
 * wrappers by the caller instead of inline marks.
 *
 * When multiple facets share the same byte range, all of their features are
 * applied as nested wrappers.
 */
const renderInlineRange = (
	bytes: Uint8Array,
	rangeStart: number,
	rangeEnd: number,
	normalizedFacets: Array<ColibriRichTextFacet>,
	preferences: ReturnType<typeof useUserPreferences>["preferences"],
): Array<JSX.Element> => {
	const boundaries = new Set<number>([rangeStart, rangeEnd]);
	for (const facet of normalizedFacets) {
		if (facet.index.byteStart > rangeStart && facet.index.byteStart < rangeEnd) {
			boundaries.add(facet.index.byteStart);
		}
		if (facet.index.byteEnd > rangeStart && facet.index.byteEnd < rangeEnd) {
			boundaries.add(facet.index.byteEnd);
		}
	}
	const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

	const result: Array<JSX.Element> = [];

	for (let i = 0; i < sortedBoundaries.length - 1; i++) {
		const start = sortedBoundaries[i];
		const end = sortedBoundaries[i + 1];
		if (start === end) continue;

		const segmentText = nlToBr(textDecoder.decode(bytes.slice(start, end)));

		const covering = normalizedFacets.filter(
			(facet) => facet.index.byteStart <= start && facet.index.byteEnd >= end,
		);

		if (covering.length === 0) {
			result.push(<span innerHTML={twemoji.parse(purify(segmentText))} />);
			continue;
		}

		const features: AnyFeature[] = [];
		const featureKeys = new Set<string>();
		for (const facet of covering) {
			for (const feature of facet.features) {
				if (isBlockFeature(feature)) continue;
				const key = buildFeatureKey(feature);
				if (featureKeys.has(key)) continue;
				featureKeys.add(key);
				features.push(feature);
			}
		}

		const channelFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#channel",
		);
		const mentionFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#mention",
		);
		const timeFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#time",
		);

		let component: JSX.Element;

		if (channelFeature) {
			component = applyStyleForFacet(segmentText, channelFeature);
		} else if (mentionFeature) {
			component = applyStyleForFacet(segmentText, mentionFeature);
		} else if (timeFeature) {
			component = applyStyleForFacet(segmentText, timeFeature);
		} else {
			let element: JSX.Element = (
				<span innerHTML={twemoji.parse(purify(segmentText))} />
			);

			for (const feature of features) {
				const wrappedElement = element;

				switch (feature.$type) {
					case "social.colibri.richtext.facet#bold":
						element = (
							<b data-facet-type="bold" class="font-bold">
								{wrappedElement}
							</b>
						);
						break;
					case "social.colibri.richtext.facet#italic":
						element = (
							<i data-facet-type="italic" class="italic">
								{wrappedElement}
							</i>
						);
						break;
					case "social.colibri.richtext.facet#underline":
						element = (
							<u data-facet-type="underline" class="underline">
								{wrappedElement}
							</u>
						);
						break;
					case "social.colibri.richtext.facet#strikethrough":
						element = (
							<span data-facet-type="strikethrough" class="line-through">
								{wrappedElement}
							</span>
						);
						break;
					case "social.colibri.richtext.facet#code":
						element = <code data-facet-type="code">{wrappedElement}</code>;
						break;
					case "social.colibri.richtext.facet#link":
						if ("uri" in feature) {
							const rawUri = String(feature.uri);
							const displayHref = () =>
								rewriteBskyUrl(rawUri, preferences().preferredBlueskyClient);
							const isBareUrl = segmentText.trim() === rawUri;
							element = (
								<a
									data-facet-type="link"
									title={displayHref()}
									data-uri={escapeAttr(rawUri)}
									href={displayHref()}
									class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline w-fit"
									target="_blank"
									rel="noreferrer"
								>
									{isBareUrl ? (
										<span innerHTML={twemoji.parse(purify(displayHref()))} />
									) : (
										wrappedElement
									)}
								</a>
							);
						}
						break;
				}
			}

			component = element;
		}

		result.push(component);
	}

	return result;
};

/**
 * Renders text with facets. Facets use byte offsets into the
 * UTF-8 encoded text, so we work with the encoded bytes directly.
 *
 * Codeblock/quote facets are block-level: each spans exactly one normalized
 * facet covering its whole (possibly multi-line) range, and is rendered as a
 * single `<pre><code>`/`<blockquote>` rather than as an inline wrapper.
 * Everything else flows through the inline-segment renderer.
 */
export const renderWithFacets = (
	input: TextWithFacets,
	_community?: string,
): Array<JSX.Element> => {
	const { preferences } = useUserPreferences();
	const bytes = textEncoder.encode(input.text);

	const normalizedFacets = normalizeFacets(input.facets);

	const blockFacets = normalizedFacets
		.filter((f) => f.features.some(isBlockFeature))
		.sort((a, b) => a.index.byteStart - b.index.byteStart);

	if (blockFacets.length === 0) {
		return renderInlineRange(bytes, 0, bytes.length, normalizedFacets, preferences);
	}

	const result: Array<JSX.Element> = [];
	let cursor = 0;

	for (const blockFacet of blockFacets) {
		if (blockFacet.index.byteStart > cursor) {
			result.push(
				...renderInlineRange(
					bytes,
					cursor,
					blockFacet.index.byteStart,
					normalizedFacets,
					preferences,
				),
			);
		}

		const codeblockFeature = blockFacet.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#codeblock",
		);
		const quoteFeature = blockFacet.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#quote",
		);

		if (codeblockFeature) {
			const lang = "lang" in codeblockFeature ? codeblockFeature.lang : undefined;
			const rawText = textDecoder.decode(
				bytes.slice(blockFacet.index.byteStart, blockFacet.index.byteEnd),
			);
			result.push(<CodeBlock lang={lang} code={rawText} />);
		} else if (quoteFeature) {
			result.push(
				<blockquote
					data-facet-type="quote"
					class="border-l-2 border-muted-foreground/40 pl-3 my-1 text-muted-foreground block"
				>
					{renderInlineRange(
						bytes,
						blockFacet.index.byteStart,
						blockFacet.index.byteEnd,
						normalizedFacets,
						preferences,
					)}
				</blockquote>,
			);
		}

		cursor = blockFacet.index.byteEnd;
	}

	if (cursor < bytes.length) {
		result.push(
			...renderInlineRange(bytes, cursor, bytes.length, normalizedFacets, preferences),
		);
	}

	return result;
};

/**
 * Validate that a string is a well-formed http(s) URL.
 * @param value The value to check
 */
export const isValidUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};
