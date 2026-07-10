import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../../atproto/xrpc/social/colibri/community/listRoles";
import {
	createMentionRenderer,
	type EmojiSuggestionData,
} from "./MentionPopupRenderer";

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

				const matchedRoles = roles()
					.filter((role) =>
						role.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 8);

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
			items: ({ query }) =>
				channels()
					.filter((channel) =>
						channel.name.toLowerCase().startsWith(query.toLowerCase()),
					)
					.slice(0, 5),
			render: createMentionRenderer("#", mainEditor),
			command: insertMention,
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
			command: insertMention,
		},
	];
};
