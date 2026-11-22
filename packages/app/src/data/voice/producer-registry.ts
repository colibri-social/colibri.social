export interface ProducerRegistry<Owner> {
	track(producerId: string, owner: Owner): void;
	owner(producerId: string): Owner | undefined;
	has(producerId: string): boolean;
	entries(): Array<[string, Owner]>;
	queue(producerId: string): void;
	pending(): ReadonlyArray<string>;
	drain(): Array<string>;
	remove(producerId: string): void;
	clear(): void;
}

export const createProducerRegistry = <Owner>(): ProducerRegistry<Owner> => {
	const owners = new Map<string, Owner>();
	let pending: Array<string> = [];

	return {
		track: (producerId, owner) => {
			owners.set(producerId, owner);
		},
		owner: (producerId) => owners.get(producerId),
		has: (producerId) => owners.has(producerId),
		entries: () => [...owners.entries()],
		queue: (producerId) => {
			if (!pending.includes(producerId)) pending.push(producerId);
		},
		pending: () => pending,
		drain: () => {
			const queued = pending;
			pending = [];
			return queued;
		},
		remove: (producerId) => {
			owners.delete(producerId);
			pending = pending.filter((id) => id !== producerId);
		},
		clear: () => {
			owners.clear();
			pending = [];
		},
	};
};
