import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
};

const del: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, role, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.role.delete?role=${encodeURIComponent(role)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
