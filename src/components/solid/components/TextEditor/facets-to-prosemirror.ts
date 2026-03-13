import type { Editor, TextType } from "@tiptap/core";
import type { Facet } from "@/utils/atproto/rich-text";
import type { MemberData } from "../../layouts/CommunityLayout";
import type { ChannelData } from "@/utils/sdk";
import twemoji from "@twemoji/api";
import type { MentionType } from "./prosemirror-to-facets";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SPLIT = "\x00";
const SPLIT_ENCODED = encoder.encode(SPLIT);

const EMOJI_IMAGE_REGEX = /<img [\s\S\w\W\d\D]+\/>/gm;
const EMOJI_IMAGE_ALT_REGEX =
	/<img [\s\S\w\W\d\D]+ alt="([\W]+)" [\s\S\w\W\d\D]+\/>/gm;

/**
 * Formats a given text with facets to a ProseMirror document.
 * @param text The text to convert.
 * @param facets The facets to apply.
 * @param members A list of all members, used for lookups of member facets.
 * @param channels A list of all channels, used for lookups of channel facets.
 * @returns A ProseMirror document.
 */
export const facetsToProseMirror = (
	text: string,
	facets: Array<Facet>,
	members: Array<MemberData>,
	channels: Array<ChannelData>,
): ReturnType<Editor["getJSON"]> => {
	const doc: ReturnType<Editor["getJSON"]> = {
		type: "doc",
		attrs: undefined,
		content: [{ type: "paragraph", content: [], attrs: undefined }],
	};

	let baseEncoded = encoder.encode(text);

	for (const facet of facets) {
		const text = decoder.decode(
			baseEncoded.slice(facet.index.byteStart, facet.index.byteEnd),
		);

		for (const feature of facet.features) {
			if (feature.$type === "social.colibri.richtext.facet#mention") {
				const member = members.find((x) => x.member_did === feature.did);
				const node: MentionType = {
					type: "mention",
					attrs: {
						id: feature.did,
						label: member?.display_name || "Unknown User",
						handle: member?.handle || "handle.invalid",
						avatar: member?.avatar_url || "/user-placeholder.png",
						type: "member",
					},
				};

				doc.content[0].content!.push(node);

				continue;
			}

			if (feature.$type === "social.colibri.richtext.facet#channel") {
				const channel = channels.find((x) => x.rkey === feature.channel);
				const node: MentionType = {
					type: "mention",
					attrs: {
						id: feature.channel,
						label: channel?.name || "Unknown Channel",
						handle: null,
						avatar: null,
						type: "channel",
					},
				};

				doc.content[0].content!.push(node);

				continue;
			}

			const node: TextType = {
				text,
				type: "text",
				marks: [],
			};

			switch (feature.$type) {
				case "social.colibri.richtext.facet#bold":
					node.marks.push({
						type: "bold",
						attrs: undefined,
					});
					break;
				case "social.colibri.richtext.facet#italic":
					node.marks.push({
						type: "italic",
						attrs: undefined,
					});
					break;
				case "social.colibri.richtext.facet#underline":
					node.marks.push({
						type: "underline",
						attrs: undefined,
					});
					break;
				case "social.colibri.richtext.facet#strikethrough":
					node.marks.push({
						type: "strike",
						attrs: undefined,
					});
					break;
				case "social.colibri.richtext.facet#code":
					node.marks.push({
						type: "code",
						attrs: undefined,
					});
					break;
				case "social.colibri.richtext.facet#link":
					node.marks.push({
						type: "link",
						attrs: {
							href: feature.uri,
							target: "_blank",
							rel: "noopener noreferrer nofollow",
							class: null,
							title: null,
						},
					});
					break;
				default:
					break;
			}

			doc.content[0].content!.push(node as any);
		}
	}

	const processedRanges = facets.map((x) => x.index);
	let offset = 0;

	for (const range of processedRanges) {
		let startEncoded = baseEncoded.slice(0, range.byteStart - offset);
		let textToRemove = baseEncoded.slice(
			range.byteStart - offset,
			range.byteEnd - offset,
		);
		let endEncoded = baseEncoded.slice(range.byteEnd - offset);

		const newEncoded = new Uint8Array(
			startEncoded.length + SPLIT_ENCODED.length + endEncoded.length,
		);
		newEncoded.set(startEncoded);
		newEncoded.set(SPLIT_ENCODED, startEncoded.length);
		newEncoded.set(endEncoded, startEncoded.length + SPLIT_ENCODED.length);

		baseEncoded = newEncoded;
		offset += textToRemove.length - SPLIT_ENCODED.length;
	}

	const splitted = decoder.decode(baseEncoded).split(SPLIT);

	let i = 0;
	offset = 0;

	for (const text of splitted) {
		if (text.length !== 0) {
			const textWithEmojis = twemoji.parse(text);

			const expandedNodes: Array<TextType | MentionType> = textWithEmojis
				.split(EMOJI_IMAGE_REGEX)
				.filter((x) => x.length > 0)
				.map((x) => ({
					type: "text",
					text: x,
					marks: [],
				}));

			let match: RegExpExecArray | null;
			let j = 1; // If the emoji is the first thing, an empty string is created

			while ((match = EMOJI_IMAGE_ALT_REGEX.exec(textWithEmojis))) {
				expandedNodes.splice(j, 0, {
					type: "mention",
					attrs: {
						type: "emoji",
						label: match[1],
						avatar: null,
						handle: null,
						id: null,
					},
				});

				j++;
			}

			doc.content[0].content!.splice(i + offset, 0, ...expandedNodes);

			offset += expandedNodes.length;
		}
		i++;
	}

	return doc;
};
