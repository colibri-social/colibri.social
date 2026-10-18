const MAX_TRACKED_DELIVERIES = 50;

const delivered = new Set<string>();
const waiting = new Map<string, Set<() => void>>();

export const markReportDelivered = (eventId: string): void => {
	if (delivered.has(eventId)) return;

	if (delivered.size >= MAX_TRACKED_DELIVERIES) {
		const oldest = delivered.keys().next();
		if (!oldest.done) delivered.delete(oldest.value);
	}
	delivered.add(eventId);

	const listeners = waiting.get(eventId);
	if (!listeners) return;

	waiting.delete(eventId);
	for (const listener of listeners) listener();
};

export const isReportDelivered = (eventId: string | undefined): boolean =>
	eventId !== undefined && delivered.has(eventId);

export const onReportDelivered = (
	eventId: string,
	listener: () => void,
): (() => void) => {
	if (delivered.has(eventId)) {
		listener();
		return () => {};
	}

	const listeners = waiting.get(eventId) ?? new Set<() => void>();
	listeners.add(listener);
	waiting.set(eventId, listeners);

	return () => {
		const current = waiting.get(eventId);
		if (!current) return;
		current.delete(listener);
		if (current.size === 0) waiting.delete(eventId);
	};
};

export const resetReportDeliveries = (): void => {
	delivered.clear();
	waiting.clear();
};
