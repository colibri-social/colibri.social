export const readStored = (key: string): string | undefined => {
	try {
		return localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
};

export const writeStored = (key: string, value: string | undefined) => {
	try {
		if (value === undefined) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {}
};

export const readStoredJSON = <T>(
	key: string,
	accept: (value: unknown) => value is T,
): T | undefined => {
	const raw = readStored(key);
	if (raw === undefined) return undefined;
	try {
		const parsed: unknown = JSON.parse(raw);
		return accept(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
};

export const writeStoredJSON = (key: string, value: unknown) => {
	if (value === undefined) {
		writeStored(key, undefined);
		return;
	}
	let encoded: string;
	try {
		encoded = JSON.stringify(value);
	} catch {
		return;
	}
	writeStored(key, encoded);
};
