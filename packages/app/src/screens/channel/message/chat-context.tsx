import {
	ChipButton,
	type EmojiPack,
	NameColorProvider,
	type RichEditorSources,
	type RichText,
	type RichTextChannel,
	type RichTextCustomEmoji,
	type RichTextExternalLink,
	type RichTextForeignFeature,
	RichTextProvider,
	type RichTextResolvers,
	RoleMention,
} from "@colibri-social/ui";
import {
	type Accessor,
	createContext,
	type JSX,
	type ParentProps,
	useContext,
} from "solid-js";
import {
	bridgePlatformName,
	displayNameOf,
} from "../../../data/adapters/authors";
import type { ForwardTarget } from "../../../data/adapters/forward";
import { roleIdentity } from "../../../data/roles";
import type { ControlsPreferences } from "../../../data/source";
import type {
	ChannelView,
	CommunityView,
	MemberView,
	Presence,
	RoleView,
	ThreadView,
} from "../../../data/types";
import { toListMember } from "../../members/member-adapter";
import type { MessageSelection } from "../selection/selection";
import type { ChatMessage } from "./types";

export type ChatPlatform = "mobile" | "desktop";

export type ChatContextValue = {
	viewer: Accessor<string>;
	platform?: Accessor<ChatPlatform>;
	editingKey?: Accessor<string | undefined>;
	onSaveEdit?: (value: RichText) => unknown;
	onCancelEdit?: () => void;
	editSources?: RichEditorSources;
	customEmoji?: (name: string) => RichTextCustomEmoji | undefined;
	customEmojiFeature?: (
		feature: RichTextForeignFeature,
	) => RichTextCustomEmoji | undefined;
	onCustomEmojiOpen?: (
		emoji: RichTextCustomEmoji,
		anchor?: HTMLElement,
	) => void;
	emojiPacks?: () => EmojiPack[];
	community: Accessor<CommunityView>;
	communities?: Accessor<ReadonlyMap<string, CommunityView>>;
	members: Accessor<ReadonlyMap<string, MemberView>>;
	roles: Accessor<ReadonlyMap<string, RoleView>>;
	channels: Accessor<ReadonlyMap<string, ChannelView>>;
	categoryName?: (rkey: string) => string | undefined;
	threadName?: (space: string) => string | undefined;
	threadChannel?: (space: string) => string | undefined;
	onOpenForwardSource?: (target: ForwardTarget) => void;
	presenceOf?: (did: string) => Presence | undefined;
	membersLoaded?: Accessor<boolean>;
	controls: Accessor<ControlsPreferences>;
	now?: Accessor<Date>;
	locale?: string;
	quickReactions?: Accessor<string[]>;
	onReply: (message: ChatMessage) => void;
	onEdit: (message: ChatMessage) => void;
	onDelete: (message: ChatMessage) => void;
	canModerate?: Accessor<boolean>;
	onExternalLink?: (href: string, link: RichTextExternalLink) => void;
	onSetHidden?: (message: ChatMessage, hidden: boolean) => void;
	onReact: (message: ChatMessage, emoji: string, add: boolean) => void;
	onPickReaction?: (message: ChatMessage) => void;
	onRetry: (message: ChatMessage) => void;
	onJumpTo: (rkey: string) => void;
	onOpenThread: (thread: string, options?: { full?: boolean }) => void;
	onThreadMenu?: (thread: ThreadView) => void;
	ThreadContextMenu?: (props: {
		thread: ThreadView;
		children: JSX.Element;
	}) => JSX.Element;
	isUnseen?: (rkey: string) => boolean;
	observeSeen?: (element: HTMLElement, rkey: string) => () => void;
	onStartThread?: (message: ChatMessage) => void;
	onOpenProfile: (did: string, anchor?: HTMLElement) => void;
	onOpenMemberMenu: (did: string) => void;
	onOpenChannel?: (skey: string) => void;
	onForward?: (message: ChatMessage) => void;
	selection?: MessageSelection;
	overlays?: () => JSX.Element;
};

const ChatContext = createContext<ChatContextValue>();

export const ChatContextProvider = (
	props: ParentProps<{ value: ChatContextValue }>,
) => (
	<ChatContext.Provider value={props.value}>
		{props.children}
		{props.value.overlays?.()}
	</ChatContext.Provider>
);

export const useChat = () => {
	const value = useContext(ChatContext);
	if (!value) throw new Error("useChat needs a ChatContextProvider");
	return value;
};

export const createChatRichTextResolvers = (
	chat: ChatContextValue,
): RichTextResolvers => ({
	get platform() {
		return chat.platform?.() ?? "mobile";
	},
	member: (did) => {
		const member = chat.members().get(did);
		return member
			? { did, name: displayNameOf(member.actor, member) }
			: undefined;
	},
	wrapMention: (member, chip) => (
		<ChipButton
			label={`Open ${member.name ?? "member"}'s profile`}
			onClick={() => chat.onOpenProfile(member.did)}
			onMenu={() => chat.onOpenMemberMenu(member.did)}
		>
			{chip}
		</ChipButton>
	),
	wrapRole: (role, chip) => {
		const view = chat.roles().get(role.rkey);
		if (!view) return chip;
		const members = () =>
			[...chat.members().values()]
				.filter((member) => member.roles.includes(role.rkey))
				.map((member) =>
					toListMember(member, {
						roleByKey: (rkey) => chat.roles().get(rkey),
						presence: chat.presenceOf?.(member.actor.did),
					}),
				);
		return (
			<RoleMention
				platform={chat.platform?.() ?? "mobile"}
				role={roleIdentity(view)}
				members={chat.membersLoaded?.() === false ? undefined : members()}
				onOpenMember={(member, event) =>
					chat.onOpenProfile(member.id, event.currentTarget as HTMLElement)
				}
				onMemberMenu={(member) => chat.onOpenMemberMenu(member.id)}
			>
				{chip}
			</RoleMention>
		);
	},
	role: (rkey) => {
		const role = chat.roles().get(rkey);
		return role ? { rkey, name: role.name, color: role.color } : undefined;
	},
	channel: (skey): RichTextChannel | undefined => {
		const channel = chat.channels().get(skey);
		if (!channel) return undefined;
		if (!channel.viewer.canRead) return { state: "locked" };
		return {
			state: "ready",
			name: channel.name,
			category: channel.category
				? chat.categoryName?.(channel.category)
				: undefined,
		};
	},
	onChannelOpen: (skey, event) => {
		if (!chat.onOpenChannel) return;
		event.preventDefault();
		chat.onOpenChannel(skey);
	},
	bridgePlatformName,
	onExternalLink: chat.onExternalLink,
	customEmoji: chat.customEmoji,
	customEmojiFeature: chat.customEmojiFeature,
	onCustomEmojiOpen: chat.onCustomEmojiOpen,
});

export const ChatRichTextProvider = (props: ParentProps) => {
	const chat = useChat();
	return (
		<NameColorProvider
			overrideUserColors={chat.community().overrideUserNameColors ?? false}
		>
			<RichTextProvider value={createChatRichTextResolvers(chat)}>
				{props.children}
			</RichTextProvider>
		</NameColorProvider>
	);
};
