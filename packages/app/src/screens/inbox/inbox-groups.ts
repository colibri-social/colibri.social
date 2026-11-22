import type { InboxNotification, InboxSpace } from "@colibri-social/ui";

export type InboxGroup = {
	space: InboxSpace;
	notifications: InboxNotification[];
};

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

export const groupSummary = (notifications: readonly InboxNotification[]) => {
	const replies = notifications.filter(
		(entry) => entry.kind === "reply",
	).length;
	const mentions = notifications.length - replies;
	return [
		mentions ? plural(mentions, "mention", "mentions") : "",
		replies ? plural(replies, "reply", "replies") : "",
	]
		.filter(Boolean)
		.join(", ");
};

export const groupBySpace = (
	notifications: readonly InboxNotification[],
	spaces: ReadonlyMap<string, InboxSpace>,
): InboxGroup[] => {
	const groups = new Map<string, InboxGroup>();
	const sorted = [...notifications].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
	for (const notification of sorted) {
		const space = spaces.get(notification.spaceId) ?? {
			id: notification.spaceId,
			name: "Unknown Space",
		};
		const group = groups.get(space.id);
		if (group) group.notifications.push(notification);
		else groups.set(space.id, { space, notifications: [notification] });
	}
	return [...groups.values()];
};
