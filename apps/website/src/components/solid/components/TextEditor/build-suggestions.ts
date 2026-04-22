import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { ChannelData } from "@/utils/sdk";
import type { MemberData } from "../../layouts/CommunityLayout";
import {
	createMentionRenderer,
	type EmojiSuggestionData,
} from "./MentionPopupRenderer";

export const buildSuggestions = (
	members: () => Array<MemberData>,
	channels: () => Array<ChannelData>,
	emojis: () => Array<EmojiSuggestionData>,
): Omit<SuggestionOptions<any, MentionNodeAttrs>, "editor">[] => {
	return [
		{
			char: "@",
			items: ({ query }) =>
				members()
					.filter(
						(member) =>
							member.display_name
								?.toLowerCase()
								.startsWith(query.toLowerCase()) ||
							member.handle?.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 8),
			render: createMentionRenderer("@"),
		},
		{
			char: "#",
			items: ({ query }) =>
				channels()
					.filter((channel) =>
						channel.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5),
			render: createMentionRenderer("#"),
		},
		{
			char: ":",
			items: ({ query }) => {
				if (query.length < 2) return [];

				return emojis()
					.filter((emoji) =>
						emoji.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5);
			},
			render: createMentionRenderer(":"),
		},
	];
};
