import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type {
	Category,
	Channel,
	Member,
	Role,
} from "../../../../contexts/community-payload";
import { ambiguousCategoryName } from "../../../../utils/channel-category";
import { searchEmojis } from "../../../../utils/emoji-data";
import type { EmojiUsage } from "../../../../utils/emoji-usage";
import { foldText } from "../../../../utils/fold-text";
import { codeContextAtPos } from "./block-projection";
import { createMentionRenderer } from "./MentionPopupRenderer";

const allowOutsideCode: NonNullable<
	SuggestionOptions<unknown, MentionNodeAttrs>["allow"]
> = ({ state, range }) => {
	const $from = state.doc.resolve(range.from);
	if (!$from.parent.type.contentMatch.matchType(state.schema.nodes.mention)) {
		return false;
	}
	return codeContextAtPos(state.doc, range.from) === null;
};

const EMOJI_LIMIT = 10;

const EMOJI_MIN_QUERY = 2;

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

export type EmojiSuggestionOptions = {
	usage: () => Record<string, EmojiUsage>;
	onPick: (emoji: string) => void;
};

export const buildSuggestions = (
	searchMembers: (query: string, limit: number) => Array<Member>,
	channels: () => Array<Channel>,
	roles: () => Array<Role>,
	categories: () => Array<Category>,
	mainEditor?: boolean,
	emoji?: EmojiSuggestionOptions,
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
			allow: allowOutsideCode,
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
			allow: allowOutsideCode,
		},
		{
			char: ":",
			items: ({ query }) =>
				query.length < EMOJI_MIN_QUERY
					? []
					: searchEmojis(query, EMOJI_LIMIT, emoji?.usage()),
			render: createMentionRenderer(":", mainEditor),
			command: (args) => {
				const picked = args.props as unknown as { label?: string };
				if (picked.label) emoji?.onPick(picked.label);
				insertMention(args);
			},
			allow: allowOutsideCode,
		},
	];
};
