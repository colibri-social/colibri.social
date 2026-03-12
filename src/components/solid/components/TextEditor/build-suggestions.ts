import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { MemberData } from "../../layouts/CommunityLayout";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { createMentionRenderer } from "./MentionPopupRenderer";

export const buildSuggestions = (
	members: Array<MemberData>,
	channels: Array<{ name: string; rkey: string }>,
): Omit<SuggestionOptions<any, MentionNodeAttrs>, "editor">[] => {
	return [
		{
			char: "@",
			items: ({ query }) =>
				members
					.filter((member) =>
						member.display_name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5),
			render: createMentionRenderer("@"),
		},
		{
			char: "#",
			items: ({ query }) =>
				channels
					.filter((channel) =>
						channel.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5),
			render: createMentionRenderer("#"),
		},
	];
};
