import { XrpcRequest } from "../../..";

type Response = {
	onlineState: string;
};

export const setState: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, state, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.actor.setState?state=${state}&auth=${auth}`,
			{
				method: "POST",
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
