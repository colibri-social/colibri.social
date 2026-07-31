import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	cursor?: string;
	records: Array<Record<string, unknown>>;
};

export const listRecords: XrpcRequest<
	[string, string, number | undefined, string | undefined, boolean | undefined],
	Promise<XrpcResult<Response>>
> = async (fetch, repo, collection, limit, cursor, reverse) => {
	const params = new URLSearchParams({ repo, collection });
	if (limit !== undefined) params.set("limit", String(limit));
	if (cursor !== undefined) params.set("cursor", cursor);
	if (reverse !== undefined) params.set("reverse", String(reverse));

	return request<Response>(fetch, {
		lxm: "com.atproto.repo.listRecords",
		route: `/xrpc/com.atproto.repo.listRecords?${params.toString()}`,
	});
};
