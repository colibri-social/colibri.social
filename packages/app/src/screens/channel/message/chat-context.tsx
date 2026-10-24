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
import type { ReactionEmoji } from "../../../data/adapters/reactions";
import type { StatusEmojiLookup } from "../../../data/adapters/status";
import { blueskyUrlRewriter } from "../../../data/bluesky-client";
import { sharedPackIn } from "../../../data/emoji/shared-pack";
import { roleIdentity } from "../../../data/roles";
import type { ControlsPreferences } from "../../../data/source";
import { useData } from "../../../data/store";
import type {
	ChannelView,
	CommunityView,
	Did,
	GifView,
	MemberView,
	Presence,
	RoleView,
	ThreadView,
} from "../../../data/types";
import { openAppLink } from "../../../native/deep-links";
import { toListMember } from "../../members/member-adapter";
import type { MessageSelection } from "../selection/selection";
import { highlightCode } from "./code-highlight";
import { type LinkTargetContext, linkTargetFor } from "./link-targets";
import type { LoadBlueskyPost } from "./MessageAttachments";
import type { ChatMessage } from "./types";

export type EmbedEditor = "author" | "moderator";

export type ChatPlatform = "mobile" | "desktop";

export type ChatContextValue = {
	viewer: Accessor<string>;
	platform?: Accessor<ChatPlatform>;
	editingKey?: Accessor<string | undefined>;
	editFocusRequest?: Accessor<number>;
	replyingKey?: Accessor<string | undefined>;
	editDraft?: () => RichText | undefined;
	onEditChange?: (value: RichText) => void;
	onSaveEdit?: (value: RichText) => unknown;
	onCancelEdit?: () => void;
	editSources?: RichEditorSources;
	customEmoji?: (name: string) => RichTextCustomEmoji | undefined;
	customEmojiByUri?: (uri: string) => RichTextCustomEmoji | undefined;
	refreshCustomEmoji?: (uri: string, src: string) => Promise<boolean>;
	customEmojiUnavailable?: (reaction: ReactionEmoji) => boolean;
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
	bridgedName?: (registration: string, remoteId: string) => string | undefined;
	roles: Accessor<ReadonlyMap<string, RoleView>>;
	channels: Accessor<ReadonlyMap<string, ChannelView>>;
	categoryName?: (rkey: string) => string | undefined;
	threadName?: (space: string) => string | undefined;
	threadNameIn?: (channel: string, thread: string) => string | undefined;
	threadChannel?: (space: string) => string | undefined;
	onOpenForwardSource?: (target: ForwardTarget) => void;
	presenceOf?: (did: string) => Presence | undefined;
	membersLoaded?: Accessor<boolean>;
	controls: Accessor<ControlsPreferences>;
	now?: Accessor<Date>;
	locale?: string;
	quickReactions?: Accessor<string[]>;
	onRecordEmoji?: (emoji: string) => void;
	canPost?: Accessor<boolean>;
	locked?: Accessor<boolean>;
	developerMode?: Accessor<boolean>;
	viewerRoles?: Accessor<readonly string[]>;
	linkEmbedsEnabled?: Accessor<boolean>;
	gifSaved?: (gif: GifView) => boolean;
	onToggleGif?: (gif: GifView, save: boolean) => void;
	onSetEmbeds?: (
		message: ChatMessage,
		uris: string[],
		as: EmbedEditor,
	) => Promise<void>;
	loadBlueskyPost?: LoadBlueskyPost;
	onOpenSpace?: (community: CommunityView) => void;
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
	memberContextMenu?: (
		did: string,
		trigger: JSX.Element,
		wrapperClass?: string,
	) => JSX.Element;
	onOpenChannel?: (skey: string) => void;
	onForward?: (message: ChatMessage) => void;
	messageLink?: (message: ChatMessage) => string | undefined;
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

const sharesName = (chat: ChatContextValue, channel: ChannelView) => {
	for (const other of chat.channels().values()) {
		if (other.space !== channel.space && other.name === channel.name) {
			return true;
		}
	}
	return false;
};

export const createChatRichTextResolvers = (
	chat: ChatContextValue,
	statusEmoji?: StatusEmojiLookup,
	pack?: LinkTargetContext["pack"],
): RichTextResolvers => {
	const desktopMenu = () =>
		chat.platform?.() === "desktop" ? chat.memberContextMenu : undefined;
	return {
		get platform() {
			return chat.platform?.() ?? "mobile";
		},
		member: (did) => {
			const member = chat.members().get(did);
			return member
				? { did, name: displayNameOf(member.actor, member) }
				: undefined;
		},
		wrapMention: (member, chip) => {
			const menu = desktopMenu();
			const button = (
				<ChipButton
					label={`Open ${member.name ?? "member"}'s profile`}
					onClick={() => chat.onOpenProfile(member.did)}
					onMenu={menu ? undefined : () => chat.onOpenMemberMenu(member.did)}
				>
					{chip}
				</ChipButton>
			);
			return menu ? menu(member.did, button, "inline") : button;
		},
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
							emoji: statusEmoji,
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
					onMemberMenu={
						desktopMenu()
							? undefined
							: (member) => chat.onOpenMemberMenu(member.id)
					}
					wrapMember={(member, row) => desktopMenu()?.(member.id, row) ?? row}
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
				category:
					channel.category && sharesName(chat, channel)
						? chat.categoryName?.(channel.category)
						: undefined,
			};
		},
		threadName: (channel, thread) => chat.threadNameIn?.(channel, thread),
		onChannelOpen: (skey, event) => {
			if (!chat.onOpenChannel) return;
			event.preventDefault();
			chat.onOpenChannel(skey);
		},
		linkTarget: (uri) =>
			linkTargetFor(uri, {
				get space() {
					return chat.community().did;
				},
				threadChannel: chat.threadChannel,
				pack,
			}),
		onNavigate: (href, event) => {
			event.preventDefault();
			if (openAppLink(href)) return;
			chat.onExternalLink?.(href, { label: href, disguised: false });
		},
		bridgePlatformName,
		bridgedMember: ({ registration, remoteId }) => {
			if (!registration || !remoteId) return undefined;
			const name = chat.bridgedName?.(registration, remoteId);
			return name ? { did: `${registration} ${remoteId}`, name } : undefined;
		},
		highlight: highlightCode,
		onExternalLink: chat.onExternalLink,
		customEmoji: chat.customEmoji,
		customEmojiFeature: chat.customEmojiFeature,
		onCustomEmojiOpen: chat.onCustomEmojiOpen,
	};
};

export const ChatRichTextProvider = (props: ParentProps) => {
	const chat = useChat();
	const data = useData();
	const packSummary: LinkTargetContext["pack"] = (target) => {
		const did = target.did as Did;
		const shared = sharedPackIn(data.emoji.catalog(did).value(), {
			did,
			rkey: target.rkey,
		});
		return shared ? { name: shared.pack.name } : undefined;
	};
	const resolvers = createChatRichTextResolvers(chat, data.emoji, packSummary);
	resolvers.channelIn = (space, skey): RichTextChannel => {
		const community = data.communities
			.value()
			?.find((entry) => entry.did === space);
		if (!community) return { state: "locked" };
		const spaceData = data.space(community);
		const channel = spaceData.channelBySlug(skey);
		if (!channel) {
			return spaceData.channels.value() === undefined
				? { state: "loading" }
				: { state: "locked" };
		}
		if (!channel.viewer.canRead) return { state: "locked" };
		return {
			state: "ready",
			name: channel.name,
			space: { name: community.name, iconSrc: community.picture },
		};
	};
	resolvers.rewriteUrl = blueskyUrlRewriter(data.preferences);
	return (
		<NameColorProvider
			overrideUserColors={chat.community().overrideUserNameColors ?? false}
		>
			<RichTextProvider value={resolvers}>{props.children}</RichTextProvider>
		</NameColorProvider>
	);
};
