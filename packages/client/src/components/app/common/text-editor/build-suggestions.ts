import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import {
	createMentionRenderer,
	type EmojiSuggestionData,
} from "./MentionPopupRenderer";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";

export const buildSuggestions = (
	members: () => Array<Member>,
	channels: () => Array<Channel>,
	emojis: () => Array<EmojiSuggestionData>,
	mainEditor?: boolean,
): Omit<SuggestionOptions<any, MentionNodeAttrs>, "editor">[] => {
	return [
		{
			char: "@",
			items: ({ query }) => {
				const matchedMembers = members()
					.filter(
						(member) =>
							member.data.displayName
								?.toLowerCase()
								.startsWith(query.toLowerCase()) ||
							member.handle
								.replaceAll("at://", "")
								?.toLowerCase()
								.startsWith(query.toLowerCase()),
					)
					.slice(0, 8);

				// Offer the `@time` shortcut at the bottom of the list while the
				// query is still a prefix of "time" — so it's there on a bare `@`
				// and as the user types toward it, but disappears once they're
				// clearly typing something else.
				if ("time".startsWith(query.toLowerCase())) {
					return [...matchedMembers, { timeShortcut: true }];
				}

				return matchedMembers;
			},
			render: createMentionRenderer("@", mainEditor),
		},
		{
			char: "#",
			items: ({ query }) =>
				channels()
					.filter((channel) =>
						channel.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5),
			render: createMentionRenderer("#", mainEditor),
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
			render: createMentionRenderer(":", mainEditor),
		},
	];
};
