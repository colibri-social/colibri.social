const messageRkey = (uri: string): string =>
	uri.slice(uri.lastIndexOf("/") + 1);

export const canAdvanceCursor = (
	current: string | undefined,
	next: string,
): boolean => {
	if (!current) return true;
	return messageRkey(next) > messageRkey(current);
};

export const clearableNotifications = <T extends { indexedAt: string }>(
	notifications: readonly T[],
	before: number | undefined,
): T[] => {
	if (before === undefined) return [...notifications];
	return notifications.filter((n) => Date.parse(n.indexedAt) <= before);
};
