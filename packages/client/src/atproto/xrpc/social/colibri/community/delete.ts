import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
};

const del: XrpcRequest<[string], Promise<Response | undefined>> = async (
	fetch,
	community,
) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.delete?community=${encodeURIComponent(community)}`,
			{ method: "POST" },
		);
		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
