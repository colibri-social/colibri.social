export const readJson = async <T>(res: Response): Promise<T | undefined> => {
	if (!res.ok) return undefined;

	const body = await res.text();
	if (!body) return undefined;

	try {
		return JSON.parse(body) as T;
	} catch {
		return undefined;
	}
};
