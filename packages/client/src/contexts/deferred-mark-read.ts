export const clearableNotifications = <T extends { indexedAt: string }>(
	notifications: readonly T[],
	before: number | undefined,
): T[] => {
	if (before === undefined) return [...notifications];
	return notifications.filter((n) => Date.parse(n.indexedAt) <= before);
};
