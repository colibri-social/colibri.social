import type { l } from "@atproto/lex";
import type { social } from "@colibri-social/lexicons";

export type ProfileView = social.colibri.beta.actor.defs.ProfileView;
export type Presence = social.colibri.beta.actor.defs.Presence;
export type Status = social.colibri.beta.actor.defs.Status;
export type VoiceState = social.colibri.beta.actor.defs.VoiceState;
export type Preferences = social.colibri.beta.actor.defs.Preferences;
export type Mute = social.colibri.beta.actor.defs.Mute;

export type CommunityView = social.colibri.beta.community.defs.CommunityView;
export type ViewerState = social.colibri.beta.community.defs.ViewerState;
export type CategoryView = social.colibri.beta.community.defs.CategoryView;
export type ChannelView = social.colibri.beta.community.defs.ChannelView;
export type ChannelViewerState =
	social.colibri.beta.community.defs.ChannelViewerState;
export type RoleView = social.colibri.beta.community.defs.RoleView;
export type RoleChannelOverride =
	social.colibri.beta.community.defs.RoleChannelOverride;
export type MemberView = social.colibri.beta.community.defs.MemberView;
export type ApplicationView =
	social.colibri.beta.community.defs.ApplicationView;
export type InvitationView = social.colibri.beta.community.defs.InvitationView;
export type ModerationView = social.colibri.beta.community.defs.ModerationView;
export type LabelView = social.colibri.beta.community.defs.LabelView;
export type BannedActorView =
	social.colibri.beta.community.defs.BannedActorView;
export type LegacyCommunityView =
	social.colibri.beta.community.defs.LegacyCommunityView;

export type MessageView = social.colibri.beta.channel.defs.MessageView;
export type DeletedMessageView =
	social.colibri.beta.channel.defs.DeletedMessageView;
export type AttachmentView = social.colibri.beta.channel.defs.AttachmentView;
export type ReactionView = social.colibri.beta.channel.defs.ReactionView;
export type UnreadStatus = social.colibri.beta.channel.defs.UnreadStatus;

export type NotificationView =
	social.colibri.beta.notification.defs.NotificationView;

export type LinkEmbed = social.colibri.beta.embed.defs.LinkEmbed;
export type EmbedImage = social.colibri.beta.embed.defs.EmbedImage;
export type EmbedVideo = social.colibri.beta.embed.defs.EmbedVideo;
export type GifView = social.colibri.beta.embed.defs.GifView;
export type GifCategory = social.colibri.beta.embed.defs.GifCategory;

export type RecordRef = social.colibri.beta.defs.RecordRef;

export type Facet = social.colibri.beta.richtext.facet.Main;

export type MessageRecord = social.colibri.beta.message.Main;
export type MessageAttachment = social.colibri.beta.message.Attachment;
export type ReactionRecord = social.colibri.beta.reaction.Main;
export type LabelRecord = social.colibri.beta.label.Main;
export type LabelSubject = social.colibri.beta.label.Subject;
export type MemberRecord = social.colibri.beta.member.Main;
export type RoleRecord = social.colibri.beta.role.Main;
export type CategoryRecord = social.colibri.beta.category.Main;
export type ChannelRecord = social.colibri.beta.channel.Main;
export type CommunityRecord = social.colibri.beta.community.Main;
export type CommunitySettingsRecord =
	social.colibri.beta.community.settings.Main;
export type ModerationRecord = social.colibri.beta.moderation.Main;
export type ActorProfileRecord = social.colibri.beta.actor.profile.Main;
export type ProfileTheme = social.colibri.beta.actor.profile.Theme;
export type ActorSettingsRecord = social.colibri.beta.actor.settings.Main;
export type ActorMuteRecord = social.colibri.beta.actor.mute.Main;
export type ChannelReadRecord = social.colibri.beta.channel.read.Main;
export type ChannelReadCursor = social.colibri.beta.channel.read.Cursor;

export type MessageParent = NonNullable<MessageView["parent"]>;

export const MESSAGE_VIEW_TYPE = "social.colibri.beta.channel.defs#messageView";

export const DELETED_MESSAGE_TYPE =
	"social.colibri.beta.channel.defs#deletedMessageView";

export const isVisibleParent = (
	parent: MessageParent,
): parent is l.$Typed<MessageView> => parent.$type === MESSAGE_VIEW_TYPE;

export const isUnavailableParent = (parent: MessageParent): boolean =>
	!isVisibleParent(parent);
