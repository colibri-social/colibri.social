import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { Category } from "../../../../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../../atproto/xrpc/social/colibri/community/listRoles";
import { ambiguousCategoryName } from "../../../../utils/channel-category";
import { searchEmojis } from "../../../../utils/emoji-data";
import { createMentionRenderer } from "./MentionPopupRenderer";

const insertMention: SuggestionOptions<unknown, MentionNodeAttrs>["command"] =
	({ editor, range, props }) => {
		editor
			.chain()
			.focus()
			.insertContentAt(range, [
				{ type: "mention", attrs: props },
				{ type: "text", text: " " },
			])
			.run();
	};

export const buildSuggestions = (
	members: () => Array<Member>,
	channels: () => Array<Channel>,
	roles: () => Array<Role>,
	categories: () => Array<Category>,
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
					.slice(0, 3);

				const matchedRoles = roles()
					.filter((role) =>
						role.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 3);

				if ("time".startsWith(query.toLowerCase())) {
					return [...matchedMembers, ...matchedRoles, { timeShortcut: true }];
				}

				return [...matchedMembers, ...matchedRoles];
			},
			render: createMentionRenderer("@", mainEditor),
			command: insertMention,
		},
		{
			char: "#",
			items: ({ query }) => {
				const all = channels();

				return all
					.filter((channel) =>
						channel.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5)
					.map((channel) => ({
						...channel,
						categoryLabel: ambiguousCategoryName(channel, all, categories()),
					}));
			},
			render: createMentionRenderer("#", mainEditor),
			command: insertMention,
		},
		{
			char: ":",
			items: ({ query }) => (query.length < 2 ? [] : searchEmojis(query, 10)),
			render: createMentionRenderer(":", mainEditor),
			command: insertMention,
		},
	];
};
