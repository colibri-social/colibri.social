import { A } from "@solidjs/router";
import twemoji from "@twemoji/api";
import type { JSX } from "solid-js";
import type { Facet } from "@/utils/atproto/rich-text";
import { purify } from "@/utils/purify";
import { useCommunityContext } from "../../contexts/CommunityContext";
import { MemberProfilePopover } from "../MemberProfilePopover";
import { useChannelContext } from "../../contexts/ChannelContext";

export type TextWithFacets = {
	text: string;
	facets: Array<Facet>;
};

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export type AnyFeature = Facet["features"][number];

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
const applyStyleForFacet = (
	text: string,
	feature: AnyFeature,
	community?: string,
): JSX.Element => {
	const communityContext = useCommunityContext();
	const channelContext = useChannelContext();

	const textWithEmojis = twemoji.parse(purify(text));

	switch (feature.$type) {
		case "social.colibri.richtext.facet#mention": {
			const did = "did" in feature ? escapeAttr(String(feature.did)) : "";

			const member = (communityContext?.members() || []).find(
				(x) => x.member_did === did,
			);

			if (!member) {
				return (
					<div
						data-facet-type="mention"
						data-did={did}
						class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline"
						innerHTML={textWithEmojis}
					/>
				);
			}

			return (
				<MemberProfilePopover
					avatar={member!.avatar_url}
					did={member!.member_did}
					displayName={member!.display_name}
					banner={member!.banner_url}
					description={member!.description}
					emoji={member!.emoji}
					handle={member!.handle}
					status={member!.status}
					class="inline"
				>
					<div
						data-facet-type="mention"
						data-did={did}
						class="bg-primary/25 hover:bg-primary/35 px-1 rounded-xs cursor-pointer inline"
						innerHTML={textWithEmojis}
					/>
				</MemberProfilePopover>
			);
		}
		case "social.colibri.richtext.facet#link": {
			const uri =
				"uri" in feature ? escapeAttr(String(feature.uri)) : escapeAttr(text);
			return (
				// biome-ignore lint/a11y/useAnchorContent: This has innerHTML set.
				<a
					data-facet-type="link"
					title={uri}
					data-uri={uri}
					href={uri}
					class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline w-fit"
					target="_blank"
					innerHTML={textWithEmojis}
				/>
			);
		}
		case "social.colibri.richtext.facet#channel": {
			const channel =
				"channel" in feature ? escapeAttr(String(feature.channel)) : "";

			const channelData = channelContext
				?.channels()
				.find((c) => c.rkey === channel);

			if (channelData) {
				const href = escapeAttr(
					`/c/${community}/${channelData.type.slice(0, 1)}/${channel}`,
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
	}

	// @ts-expect-error - Fallback just to be sure
	return `[UNKNOWN FACET: ${feature.$type}]`;
};

/**
 * Renders text with facets. Facets use byte offsets into the
 * UTF-8 encoded text, so we work with the encoded bytes directly and build
 * the result string by walking through sorted, non-overlapping segments.
 *
 * When multiple facets share the same byte range, all of their features are
 * applied as nested wrappers.
 */
export const renderWithFacets = (
	input: TextWithFacets,
	community?: string,
): Array<JSX.Element> => {
	const bytes = textEncoder.encode(input.text);

	const sortedFacets = [...input.facets].sort((a, b) => {
		if (a.index.byteStart !== b.index.byteStart) {
			return a.index.byteStart - b.index.byteStart;
		}
		return a.index.byteEnd - b.index.byteEnd;
	});

	type FacetGroup = {
		byteStart: number;
		byteEnd: number;
		features: AnyFeature[];
	};
	const groups: FacetGroup[] = [];

	for (const facet of sortedFacets) {
		const last = groups[groups.length - 1];
		if (
			last &&
			last.byteStart === facet.index.byteStart &&
			last.byteEnd === facet.index.byteEnd
		) {
			last.features.push(...facet.features);
		} else {
			groups.push({
				byteStart: facet.index.byteStart,
				byteEnd: facet.index.byteEnd,
				features: [...facet.features],
			});
		}
	}

	const result: Array<JSX.Element> = [];
	let cursor = 0;

	for (const group of groups) {
		if (group.byteStart < cursor) continue;

		if (group.byteStart > cursor) {
			result.push(
				<span
					innerHTML={twemoji.parse(
						purify(
							nlToBr(textDecoder.decode(bytes.slice(cursor, group.byteStart))),
						),
					)}
				/>,
			);
		}

		const facetText = nlToBr(
			textDecoder.decode(bytes.slice(group.byteStart, group.byteEnd)),
		);

		// If a channel mention is present, render ONLY the channel mention
		// style - other formatting features are stripped to prevent forgery.
		const channelFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#channel",
		);
		const mentionFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#mention",
		);

		let component: JSX.Element;

		if (channelFeature) {
			component = applyStyleForFacet(facetText, channelFeature, community);
		} else if (mentionFeature) {
			component = applyStyleForFacet(facetText, mentionFeature, community);
		} else {
			for (const feature of group.features) {
				component = applyStyleForFacet(facetText, feature, community);
			}
		}

		result.push(component);
		cursor = group.byteEnd;
	}

	if (cursor < bytes.length) {
		result.push(
			<span
				innerHTML={twemoji.parse(
					purify(nlToBr(textDecoder.decode(bytes.slice(cursor)))),
				)}
			/>,
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
