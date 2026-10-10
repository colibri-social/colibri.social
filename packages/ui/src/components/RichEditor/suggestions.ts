import type { Editor, Range } from "@tiptap/core";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type {
	SuggestionKeyDownProps,
	SuggestionOptions,
	SuggestionProps,
} from "@tiptap/suggestion";
import { searchEmojis } from "../../utils/emoji-data";
import { foldText } from "../../utils/fold-text";
import { codeContextAtPos } from "./block-projection";
import type {
	BridgedSuggestion,
	ChannelSuggestion,
	MemberSuggestion,
	RichEditorSources,
	RoleSuggestion,
} from "./types";

export type SuggestionTrigger = "@" | "#" | ":";

export type SuggestionItem =
	| { kind: "member"; member: MemberSuggestion }
	| { kind: "bridged"; person: BridgedSuggestion }
	| { kind: "role"; role: RoleSuggestion }
	| { kind: "channel"; channel: ChannelSuggestion }
	| { kind: "emoji"; emoji: string; name: string }
	| { kind: "time" };

export type SuggestionSession = {
	trigger: SuggestionTrigger;
	query: string;
	items: SuggestionItem[];
	editor: Editor;
	range: Range;
	command: (attrs: Record<string, unknown>) => void;
};

export type SuggestionController = {
	start: (session: SuggestionSession) => void;
	update: (session: SuggestionSession) => void;
	keyDown: (event: KeyboardEvent) => boolean;
	exit: () => void;
};

export const EMOJI_LIMIT = 10;
export const EMOJI_MIN_QUERY = 2;
const MEMBER_LIMIT = 6;
const ROLE_LIMIT = 3;
const BRIDGED_LIMIT = 3;
const CHANNEL_LIMIT = 5;

const KIND_RANK: Record<SuggestionItem["kind"], number> = {
	member: 0,
	bridged: 1,
	role: 2,
	channel: 3,
	emoji: 3,
	time: 4,
};

export const sortSuggestions = (items: ReadonlyArray<SuggestionItem>) =>
	[...items].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);

export const suggestionAttrs = (
	item: SuggestionItem,
): Record<string, unknown> | null => {
	switch (item.kind) {
		case "member":
			return {
				id: item.member.did,
				label: item.member.name,
				handle: item.member.handle ?? null,
				avatar: item.member.avatarSrc ?? null,
				type: "member",
			};
		case "bridged":
			return {
				id: item.person.remoteId,
				label: item.person.name,
				avatar: item.person.avatarSrc ?? null,
				registration: item.person.registration,
				platform: item.person.platform,
				type: "bridged",
			};
		case "role":
			return {
				id: item.role.id,
				label: item.role.name,
				color: item.role.color ?? null,
				type: "role",
			};
		case "channel":
			return {
				id: item.channel.id,
				label: item.channel.name,
				category: item.channel.categoryLabel ?? null,
				type: "channel",
			};
		case "emoji":
			return { label: item.emoji, type: "emoji" };
		case "time":
			return null;
	}
};

const allowOutsideCode: NonNullable<
	SuggestionOptions<SuggestionItem, MentionNodeAttrs>["allow"]
> = ({ state, range }) => {
	const $from = state.doc.resolve(range.from);
	if (!$from.parent.type.contentMatch.matchType(state.schema.nodes.mention)) {
		return false;
	}
	return codeContextAtPos(state.doc, range.from) === null;
};

const insertChip = (editor: Editor, range: Range, attrs: MentionNodeAttrs) => {
	editor
		.chain()
		.focus()
		.insertContentAt(range, [
			{ type: "mention", attrs },
			{ type: "text", text: " " },
		])
		.run();
};

const insertEmojiText = (editor: Editor, range: Range, emoji: string) => {
	editor.chain().focus().insertContentAt(range, emoji).run();
};

const renderer =
	(trigger: SuggestionTrigger, controller: SuggestionController) => () => {
		const toSession = (
			props: SuggestionProps<SuggestionItem, MentionNodeAttrs>,
		): SuggestionSession => ({
			trigger,
			query: props.query,
			items: sortSuggestions(props.items),
			editor: props.editor,
			range: props.range,
			command: (attrs) => props.command(attrs as unknown as MentionNodeAttrs),
		});
		return {
			onStart: (props: SuggestionProps<SuggestionItem, MentionNodeAttrs>) =>
				controller.start(toSession(props)),
			onUpdate: (props: SuggestionProps<SuggestionItem, MentionNodeAttrs>) =>
				controller.update(toSession(props)),
			onKeyDown: (props: SuggestionKeyDownProps) =>
				controller.keyDown(props.event),
			onExit: () => controller.exit(),
		};
	};

export const buildSuggestions = (
	sources: () => RichEditorSources,
	controller: SuggestionController,
): Omit<SuggestionOptions<SuggestionItem, MentionNodeAttrs>, "editor">[] => [
	{
		char: "@",
		items: ({ query }) => {
			const source = sources();
			const folded = foldText(query);
			const members: SuggestionItem[] = (
				source.searchMembers?.(query, MEMBER_LIMIT) ?? []
			).map((member) => ({ kind: "member", member }));
			const bridged: SuggestionItem[] = (
				source.searchBridged?.(query, BRIDGED_LIMIT) ?? []
			).map((person) => ({ kind: "bridged", person }));
			const roles: SuggestionItem[] = (source.roles?.() ?? [])
				.filter((role) => foldText(role.name).startsWith(folded))
				.slice(0, ROLE_LIMIT)
				.map((role) => ({ kind: "role", role }));
			const time: SuggestionItem[] =
				source.timeShortcut !== false && "time".startsWith(folded)
					? [{ kind: "time" }]
					: [];
			return [...members, ...bridged, ...roles, ...time];
		},
		render: renderer("@", controller),
		command: ({ editor, range, props }) => insertChip(editor, range, props),
		allow: allowOutsideCode,
	},
	{
		char: "#",
		items: ({ query }) => {
			const folded = foldText(query);
			return (sources().channels?.() ?? [])
				.filter((channel) => foldText(channel.name).startsWith(folded))
				.slice(0, CHANNEL_LIMIT)
				.map((channel) => ({ kind: "channel", channel }));
		},
		render: renderer("#", controller),
		command: ({ editor, range, props }) => insertChip(editor, range, props),
		allow: allowOutsideCode,
	},
	{
		char: ":",
		items: ({ query }) =>
			query.length < EMOJI_MIN_QUERY
				? []
				: searchEmojis(query, EMOJI_LIMIT, sources().emojiUsage?.()).map(
						(match) => ({
							kind: "emoji",
							emoji: match.emoji,
							name: match.name,
						}),
					),
		render: renderer(":", controller),
		command: ({ editor, range, props }) => {
			const emoji = String(props.label ?? "");
			if (!emoji) return;
			sources().onEmojiPick?.(emoji);
			insertEmojiText(editor, range, emoji);
		},
		allow: allowOutsideCode,
	},
];
