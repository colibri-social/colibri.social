import type { XrpcRequest } from "../../..";

type Response = {
	unregistered: boolean;
};

export const unregisterPush: XrpcRequest<
	[string, string?],
	Promise<Response | undefined>
> = async (fetch, endpoint, provider) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.unregisterPush`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(provider ? { endpoint, provider } : { endpoint }),
			},
		);

		if (!res.ok) {
			console.error(`unregisterPush failed: ${res.status} ${await res.text()}`);
			return undefined;
		}
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
