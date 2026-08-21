import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { Category } from "../../../../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../../atproto/xrpc/social/colibri/community/listRoles";
import { ambiguousCategoryName } from "../../../../utils/channel-category";
import { searchEmojis } from "../../../../utils/emoji-data";
import { foldText } from "../../../../utils/fold-text";
import { createMentionRenderer } from "./MentionPopupRenderer";

const MEMBER_LIMIT = 6;

const ROLE_LIMIT = 3;

const CHANNEL_LIMIT = 5;

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
	searchMembers: (query: string, limit: number) => Array<Member>,
	channels: () => Array<Channel>,
	roles: () => Array<Role>,
	categories: () => Array<Category>,
	mainEditor?: boolean,
): Omit<SuggestionOptions<any, MentionNodeAttrs>, "editor">[] => {
	return [
		{
			char: "@",
			items: ({ query }) => {
				const q = foldText(query);

				const matchedMembers = searchMembers(query, MEMBER_LIMIT);

				const matchedRoles = roles()
					.filter((role) => foldText(role.name).startsWith(q))
					.slice(0, ROLE_LIMIT);

				if ("time".startsWith(q)) {
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
				const q = foldText(query);
				const all = channels();

				return all
					.filter((channel) => foldText(channel.name).startsWith(q))
					.slice(0, CHANNEL_LIMIT)
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
