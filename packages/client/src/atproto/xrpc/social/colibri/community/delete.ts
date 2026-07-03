import type { XrpcRequest } from "../../..";

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
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
