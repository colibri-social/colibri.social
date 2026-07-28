import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	cursor?: string;
	records: Array<Record<string, unknown>>;
};

export const listRecords: XrpcRequest<
	[string, string, number | undefined, string | undefined, boolean | undefined],
	Promise<Response | undefined>
> = async (fetch, repo, collection, limit, cursor, reverse) => {
	try {
		const params = new URLSearchParams({ repo, collection });
		if (limit !== undefined) params.set("limit", String(limit));
		if (cursor !== undefined) params.set("cursor", cursor);
		if (reverse !== undefined) params.set("reverse", String(reverse));

		const res = await fetch(
			`/xrpc/com.atproto.repo.listRecords?${params.toString()}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
