export type ActorTypeaheadResult = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
};

type Response = {
	actors: Array<ActorTypeaheadResult>;
};

const PUBLIC_APPVIEW = "https://public.api.bsky.app";

export const searchActorsTypeahead = async (
	q: string,
	signal?: AbortSignal,
): Promise<Array<ActorTypeaheadResult>> => {
	const trimmed = q.trim();
	if (trimmed.length === 0) return [];

	const url = `${PUBLIC_APPVIEW}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(trimmed)}&limit=8`;

	try {
		const res = await fetch(url, { signal });
		if (!res.ok) return [];
		const body = (await res.json()) as Response;
		return body.actors ?? [];
	} catch (err) {
		if ((err as DOMException)?.name === "AbortError") return [];
		console.error(err);
		return [];
	}
};
