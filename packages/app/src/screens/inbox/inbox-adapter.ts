import type { InboxNotification, InboxSpace } from "@colibri-social/ui";
import {
	type AuthorDirectory,
	toMessageAuthor,
} from "../../data/adapters/authors";
import { previewText } from "../../data/adapters/facets";
import { skeyOf, spaceKey } from "../../data/ids";
import { isUnread } from "../../data/notifications";
import type {
	CommunityView,
	Facet,
	MessageView,
	NotificationView,
	RoleView,
	SpaceRef,
} from "../../data/types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MENTION = "social.colibri.beta.richtext.facet#mention";
const ROLE = "social.colibri.beta.richtext.facet#role";

type Feature = { $type?: string; did?: string; role?: string };

const featureOf = (facet: Facet) =>
	facet.features as unknown as readonly Feature[];

export const withoutFacet = (text: string, facet: Facet | undefined) => {
	if (!facet) return text.trim();
	const bytes = encoder.encode(text);
	const { byteStart, byteEnd } = facet.index;
	if (byteStart < 0 || byteEnd > bytes.length || byteEnd <= byteStart) {
		return text.trim();
	}
	const before = decoder.decode(bytes.slice(0, byteStart));
	const after = decoder.decode(bytes.slice(byteEnd));
	const glue = /^\s*[,.:;!?]/.test(after) ? "" : " ";
	return `${before.trimEnd()}${glue}${after.trimStart()}`
		.replace(/^[\s,:]+/, "")
		.trim();
};

const mentionFacet = (
	message: MessageView | undefined,
	viewer: string,
	roleKey: string | undefined,
) =>
	message?.facets?.find((facet) =>
		featureOf(facet).some(
			(feature) =>
				(feature.$type === MENTION && feature.did === viewer) ||
				(!!roleKey && feature.$type === ROLE && feature.role === roleKey),
		),
	);

export const channelTypeOf = (ref: SpaceRef | string) => {
	const parts = ref.split("/");
	return parts[parts.length - 2] ?? "";
};

export type InboxContext = {
	viewer: string;
	viewerLabel: string;
	communities: ReadonlyMap<string, CommunityView>;
	directory: (community: string) => AuthorDirectory | undefined;
	roles: (community: string) => readonly RoleView[];
	channelName: (community: string, channel: SpaceRef) => string | undefined;
	threadName: (thread: SpaceRef) => string | undefined;
};

export const toInboxSpace = (community: CommunityView): InboxSpace => ({
	id: spaceKey(community),
	name: community.name,
	iconSrc: community.picture,
});

export const toInboxNotification = (
	view: NotificationView,
	context: InboxContext,
): InboxNotification => {
	const directory = context.directory(view.community) ?? {
		members: new Map(),
		roles: new Map(),
	};
	const author = toMessageAuthor(view.author, directory);
	const role = view.mentionRole
		? context
				.roles(view.community)
				.find((entry) => entry.name === view.mentionRole)
		: undefined;
	const reply = view.kind === "reply";
	const message = view.message;
	const text = message
		? reply
			? message.text.trim()
			: withoutFacet(
					message.text,
					mentionFacet(message, context.viewer, role?.rkey),
				)
		: "";
	const parent = message?.parent as { text?: string } | undefined;
	const notification: InboxNotification = {
		id: view.id,
		kind: reply ? "reply" : role ? "roleMention" : "mention",
		spaceId: view.community,
		channelName:
			context.channelName(view.community, view.channel) ?? skeyOf(view.channel),
		author: author.name,
		nameColor: author.nameColor,
		role: author.role,
		timestamp: view.indexedAt,
		text: previewText(text || (message ? "" : "Message unavailable"), 280),
		read: !isUnread(view),
	};
	if (view.thread) {
		notification.threadName = context.threadName(view.thread) ?? "Thread";
	}
	if (!reply) {
		notification.mentionLabel = role
			? `@${role.name}`
			: `@${context.viewerLabel}`;
		if (role?.color) notification.mentionRoleColor = role.color;
	}
	if (reply && parent?.text) notification.replyTo = previewText(parent.text);
	return notification;
};

export type InboxTarget = {
	space: string;
	channel: string;
	channelType: string;
	thread?: string;
	jumpChannel: SpaceRef;
	rkey?: string;
};

export const inboxTarget = (view: NotificationView): InboxTarget => {
	const target: InboxTarget = {
		space: view.community,
		channel: skeyOf(view.channel),
		channelType: channelTypeOf(view.channel),
		jumpChannel: view.thread ?? view.channel,
	};
	if (view.thread) target.thread = skeyOf(view.thread);
	if (view.message?.rkey) target.rkey = view.message.rkey;
	return target;
};
