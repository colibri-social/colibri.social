import type { XrpcRequest } from "../../..";

type PushSubscription = {
	platform: "web" | "tauri";
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
};

type Response = {
	registered: boolean;
};

export const registerPush: XrpcRequest<
	[PushSubscription, string],
	Promise<Response | undefined>
> = async (fetch, subscription, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.registerPush?auth=${auth}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(subscription),
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
