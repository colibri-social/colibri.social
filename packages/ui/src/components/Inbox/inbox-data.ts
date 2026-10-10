import type { TimeInput } from "../../utils/time";
import type { RoleIdentity } from "../Roles/RoleBadge";

export type InboxNotificationKind = "mention" | "roleMention" | "reply";

export type InboxFilter = "all" | "mentions" | "replies";

export type InboxCategory = Exclude<InboxFilter, "all">;

export type InboxStatus = "ready" | "loading" | "error";

export type InboxSpace = {
	id: string;
	name: string;
	iconSrc?: string;
};

export type InboxNotification = {
	id: string;
	kind: InboxNotificationKind;
	spaceId: string;
	channelName: string;
	threadName?: string;
	author: string;
	nameColor?: string;
	role?: RoleIdentity;
	team?: boolean;
	timestamp: TimeInput;
	text: string;
	mentionLabel?: string;
	mentionRoleColor?: string;
	replyTo?: string;
	read: boolean;
};

export type InboxPopoverProps = {
	spaces: InboxSpace[];
	notifications: InboxNotification[];
	status?: InboxStatus;
	now?: TimeInput;
	locale?: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	onOpenNotification: (id: string) => void;
	onMarkRead: (id: string) => void;
	onMarkAllRead: () => void;
	onMarkCategoryRead: (category: InboxCategory) => void;
	onMarkSpaceRead: (spaceId: string) => void;
	onRetry?: () => void;
	onOpenSettings?: () => void;
};

export const matchesFilter = (
	notification: InboxNotification,
	filter: InboxFilter,
) => {
	if (filter === "all") return true;
	if (filter === "replies") return notification.kind === "reply";
	return notification.kind !== "reply";
};

const toTime = (value: TimeInput) =>
	value instanceof Date ? value.getTime() : new Date(value).getTime();

export const newestFirst = (notifications: InboxNotification[]) =>
	[...notifications].sort((a, b) => toTime(b.timestamp) - toTime(a.timestamp));

export const unreadCount = (notifications: InboxNotification[]) =>
	notifications.filter((notification) => !notification.read).length;

export const countFor = (
	notifications: InboxNotification[],
	filter: InboxFilter,
) =>
	unreadCount(
		notifications.filter((notification) => matchesFilter(notification, filter)),
	);

export const kindLabel = (notification: InboxNotification) => {
	if (notification.kind === "reply") return "Replied to you";
	if (notification.kind === "roleMention" && notification.mentionLabel)
		return `Mentioned you via ${notification.mentionLabel}`;
	return "Mentioned you";
};

const startOfDay = (value: TimeInput) => {
	const date = new Date(toTime(value));
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
};

export const dayLabel = (
	value: TimeInput,
	now: TimeInput = new Date(),
	locale?: string,
) => {
	const days = Math.round(
		(startOfDay(now) - startOfDay(value)) / (24 * 60 * 60 * 1000),
	);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	const date = new Date(toTime(value));
	return new Intl.DateTimeFormat(locale, {
		weekday: days < 7 ? "long" : undefined,
		day: "numeric",
		month: "long",
		year:
			date.getFullYear() === new Date(toTime(now)).getFullYear()
				? undefined
				: "numeric",
	}).format(date);
};

export type InboxDayGroup = {
	key: number;
	label: string;
	notifications: InboxNotification[];
};

export const groupByDay = (
	notifications: InboxNotification[],
	now?: TimeInput,
	locale?: string,
): InboxDayGroup[] => {
	const groups: InboxDayGroup[] = [];
	for (const notification of newestFirst(notifications)) {
		const key = startOfDay(notification.timestamp);
		const last = groups.at(-1);
		if (last && last.key === key) last.notifications.push(notification);
		else
			groups.push({
				key,
				label: dayLabel(notification.timestamp, now, locale),
				notifications: [notification],
			});
	}
	return groups;
};

export const channelLabel = (notification: InboxNotification) =>
	notification.threadName
		? `#${notification.channelName} › ${notification.threadName}`
		: `#${notification.channelName}`;
