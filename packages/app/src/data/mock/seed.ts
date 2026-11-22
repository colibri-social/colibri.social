export type Random = {
	next: () => number;
	int: (min: number, max: number) => number;
	pick: <T>(items: readonly T[]) => T;
	chance: (probability: number) => boolean;
};

export const createRandom = (seed: number): Random => {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
	const int = (min: number, max: number) =>
		min + Math.floor(next() * (max - min + 1));
	const pick = <T>(items: readonly T[]) => items[int(0, items.length - 1)] as T;
	const chance = (probability: number) => next() < probability;
	return { next, int, pick, chance };
};

export const hashString = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};
