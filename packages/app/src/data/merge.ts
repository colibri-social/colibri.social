type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
	typeof value === "object" &&
	value !== null &&
	Object.getPrototypeOf(value) === Object.prototype;

const IDENTITY_FIELDS = ["space", "did", "uri", "id", "rkey"] as const;

const identityOf = (entry: unknown, index: number): string => {
	if (isPlain(entry)) {
		for (const field of IDENTITY_FIELDS) {
			const value = entry[field];
			if (typeof value === "string") return `${field}:${value}`;
		}
		const actor = entry.actor;
		if (isPlain(actor) && typeof actor.did === "string") {
			return `actor:${actor.did}`;
		}
	}
	return `at:${index}`;
};

const shareArray = (
	previous: readonly unknown[],
	next: readonly unknown[],
): readonly unknown[] => {
	const known = new Map<string, unknown>();
	previous.forEach((entry, index) => {
		known.set(identityOf(entry, index), entry);
	});
	let changed = previous.length !== next.length;
	const merged = next.map((entry, index) => {
		const key = identityOf(entry, index);
		const kept = known.has(key) ? keepUnchanged(known.get(key), entry) : entry;
		if (kept !== previous[index]) changed = true;
		return kept;
	});
	return changed ? merged : previous;
};

const shareObject = (previous: Plain, next: Plain): Plain => {
	const nextKeys = Object.keys(next);
	let changed = Object.keys(previous).length !== nextKeys.length;
	const merged: Plain = {};
	for (const key of nextKeys) {
		const kept = Object.hasOwn(previous, key)
			? keepUnchanged(previous[key], next[key])
			: next[key];
		if (!Object.hasOwn(previous, key) || kept !== previous[key]) {
			changed = true;
		}
		merged[key] = kept;
	}
	return changed ? merged : previous;
};

export const keepUnchanged = <T>(previous: T, next: T): T => {
	if (Object.is(previous, next)) return previous;
	if (Array.isArray(previous) && Array.isArray(next)) {
		return shareArray(previous, next) as T;
	}
	if (isPlain(previous) && isPlain(next)) {
		return shareObject(previous, next) as T;
	}
	return next;
};
