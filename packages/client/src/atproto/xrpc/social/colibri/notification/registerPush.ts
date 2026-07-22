import type { XrpcRequest } from "../../..";

export type WebPushSubscription = {
	platform: "web";
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
};

export type FcmPushSubscription = {
	platform: "tauri" | "android";
	token: string;
};

export type PushSubscription = WebPushSubscription | FcmPushSubscription;

type Response = {
	registered: boolean;
};

const toWireBody = (subscription: PushSubscription) =>
	"token" in subscription
		? {
				platform: subscription.platform,
				subscription: {
					$type: "social.colibri.notification.registerPush#fcmSubscription",
					token: subscription.token,
				},
			}
		: {
				platform: subscription.platform,
				subscription: {
					$type: "social.colibri.notification.registerPush#webPushSubscription",
					endpoint: subscription.endpoint,
					keys: subscription.keys,
				},
			};

export const registerPush: XrpcRequest<
	[PushSubscription],
	Promise<Response | undefined>
> = async (fetch, subscription) => {
	try {
		const res = await fetch(`/xrpc/social.colibri.notification.registerPush`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(toWireBody(subscription)),
		});

		// A non-2xx still carries a JSON body (e.g. an InvalidRequest error
		// shape), so callers checking the resolved value would treat it as
		// success. Surface the failure as `undefined` instead
		if (!res.ok) {
			console.error(`registerPush failed: ${res.status} ${await res.text()}`);
			return undefined;
		}
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
