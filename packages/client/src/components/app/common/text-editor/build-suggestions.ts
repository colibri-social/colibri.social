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
	embedRoot?: HTMLElement,
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
			render: createMentionRenderer("@", mainEditor, embedRoot),
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
			render: createMentionRenderer("#", mainEditor, embedRoot),
			command: insertMention,
		},
		{
			char: ":",
			items: ({ query }) => {
				if (query.length < 2) return [];

				const q = query.toLowerCase();
				const prefix: EmojiSuggestionData[] = [];
				const substring: EmojiSuggestionData[] = [];
				for (const emoji of emojis()) {
					const name = emoji.name.toLowerCase();
					if (name.startsWith(q)) prefix.push(emoji);
					else if (name.includes(q)) substring.push(emoji);
				}
				return [...prefix, ...substring].slice(0, 5);
			},
			render: createMentionRenderer(":", mainEditor, embedRoot),
			command: insertMention,
		},
	];
};
