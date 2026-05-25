import { XrpcRequest } from "../../..";

type Response = {
	cursor?: string;
	records: Array<Record<string, unknown>>;
};

export const listRecords: XrpcRequest<
	[string, string, number | undefined, string | undefined, boolean | undefined],
	Promise<Response | undefined>
> = async (fetch, repo, collection, limit, cursor, reverse) => {
	try {
		const res = await fetch(
			`/xrpc/com.atproto.repo.listRecords?repo=${repo}&collection=${collection}&limit=${limit}&cursor=${cursor}&reverse=${reverse}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
