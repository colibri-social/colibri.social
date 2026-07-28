import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	uri: string;
};

const del: XrpcRequest<[string], Promise<Response | undefined>> = async (
	fetch,
	role,
) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.role.delete?role=${encodeURIComponent(role)}`,
			{ method: "POST" },
		);
		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
