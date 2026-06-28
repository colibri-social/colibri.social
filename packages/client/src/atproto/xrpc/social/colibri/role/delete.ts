import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
};

const del: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, role) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.role.delete?role=${encodeURIComponent(role)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
