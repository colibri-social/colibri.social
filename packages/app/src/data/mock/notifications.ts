import type {
	Did,
	MessageView,
	NotificationView,
	RoleView,
	SpaceRef,
} from "../types";
import type { World } from "./world";

const SEEN_THREAD_AGE_MS = 6 * 60 * 60 * 1000;

type FacetFeature = { $type?: string; did?: string; role?: string };

const featuresOf = (message: MessageView) =>
	(message.facets ?? []).flatMap(
		(facet) => facet.features as unknown as FacetFeature[],
	);

const parentAuthor = (message: MessageView) =>
	(message.parent as { author?: { did?: string } } | undefined)?.author?.did;

export type NotificationContext = {
	viewer: Did;
	viewerRoles: readonly string[];
	roles: readonly RoleView[];
};

export const notificationReason = (
	message: MessageView,
	context: NotificationContext,
): { kind: "mention" | "reply"; mentionRole?: string } | undefined => {
	if (message.author.did === context.viewer) return undefined;
	const features = featuresOf(message);
	if (features.some((feature) => feature.did === context.viewer)) {
		return { kind: "mention" };
	}
	const role = features
		.map((feature) => feature.role)
		.find((rkey) => !!rkey && context.viewerRoles.includes(rkey));
	if (role) {
		const name = context.roles.find((entry) => entry.rkey === role)?.name;
		return { kind: "mention", mentionRole: name ?? role };
	}
	if (parentAuthor(message) === context.viewer) return { kind: "reply" };
	return undefined;
};

export const notificationFor = (
	message: MessageView,
	place: { community: Did; channel: SpaceRef; thread?: SpaceRef },
	context: NotificationContext,
	seenAt?: string,
): NotificationView | undefined => {
	const reason = notificationReason(message, context);
	if (!reason) return undefined;
	const view: NotificationView = {
		id: `${reason.kind}:${message.uri}`,
		kind: reason.kind,
		author: message.author,
		channel: place.channel,
		community: place.community,
		message,
		indexedAt: message.createdAt,
	};
	if (place.thread) view.thread = place.thread;
	if (reason.mentionRole) view.mentionRole = reason.mentionRole;
	if (seenAt) view.seenAt = seenAt as NotificationView["seenAt"];
	return view;
};

export const contextFor = (
	world: World,
	community: Did,
): NotificationContext | undefined => {
	const space = world.spaces.find((entry) => entry.did === community);
	if (!space) return undefined;
	return {
		viewer: world.viewerDid,
		viewerRoles: space.view.viewer?.roles ?? [],
		roles: space.roles,
	};
};

export const deriveNotifications = (
	world: World,
	now: number,
): NotificationView[] => {
	const out: NotificationView[] = [];
	for (const space of world.spaces) {
		const context = contextFor(world, space.did);
		if (!context) continue;
		for (const channel of space.channels) {
			const messages = world.messagesOf(channel);
			const cursor = channel.readCursor;
			for (const message of messages) {
				const seen = !!cursor && message.rkey <= cursor;
				const view = notificationFor(
					message,
					{ community: space.did, channel: channel.view.space },
					context,
					seen ? message.createdAt : undefined,
				);
				if (view) out.push(view);
			}
		}
		for (const thread of space.threads) {
			for (const message of thread.messages) {
				const seen = now - Date.parse(message.createdAt) > SEEN_THREAD_AGE_MS;
				const view = notificationFor(
					message,
					{
						community: space.did,
						channel: thread.view.channel as SpaceRef,
						thread: thread.view.space,
					},
					context,
					seen ? message.createdAt : undefined,
				);
				if (view) out.push(view);
			}
		}
	}
	return out.sort((a, b) => Date.parse(b.indexedAt) - Date.parse(a.indexedAt));
};
