export type Lru<T> = {
	remember: (key: string, value: T) => string[];
	recall: (key: string) => T | undefined;
	peek: (key: string) => T | undefined;
	forget: (key: string) => void;
	forgetWhere: (match: (key: string) => boolean) => void;
	clear: () => void;
	keys: () => string[];
};

export const createLru = <T>(max: number): Lru<T> => {
	const entries = new Map<string, T>();
	return {
		remember: (key, value) => {
			entries.delete(key);
			entries.set(key, value);
			const evicted: string[] = [];
			while (entries.size > max) {
				const oldest = entries.keys().next();
				if (oldest.done) break;
				entries.delete(oldest.value);
				evicted.push(oldest.value);
			}
			return evicted;
		},
		recall: (key) => {
			const value = entries.get(key);
			if (value === undefined) return undefined;
			entries.delete(key);
			entries.set(key, value);
			return value;
		},
		peek: (key) => entries.get(key),
		forget: (key) => {
			entries.delete(key);
		},
		forgetWhere: (match) => {
			for (const key of [...entries.keys()])
				if (match(key)) entries.delete(key);
		},
		clear: () => entries.clear(),
		keys: () => [...entries.keys()],
	};
};
