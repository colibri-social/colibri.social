import { colibri } from "../atproto/lexicons";
import type { ColibriClient } from "../atproto/xrpc";
import type { ApnsSubscription } from "./push-apns";
import type { FcmSubscription } from "./push-fcm";
import type { WebPushSubscription } from "./push-web";

export type PushSubscription =
	| WebPushSubscription
	| FcmSubscription
	| ApnsSubscription;

const registerBody = (sub: PushSubscription) => {
	if (sub.platform === "web") {
		return {
			provider: "webpush",
			platform: "web",
			endpoint: sub.endpoint,
			p256dh: sub.keys.p256dh,
			auth: sub.keys.auth,
		};
	}
	if (sub.platform === "android") {
		return { provider: "fcm", platform: "android", token: sub.token };
	}
	return {
		provider: "apns",
		platform: sub.platform,
		token: sub.token,
		environment: sub.environment,
	};
};

export const registerPushWith =
	(xrpc: ColibriClient) =>
	(sub: PushSubscription): Promise<unknown> =>
		xrpc.push(colibri.notification.registerPush.main, {
			body: registerBody(sub),
		});

export const unregisterPushWith =
	(xrpc: ColibriClient) =>
	(endpointOrToken: string, provider?: string): Promise<unknown> =>
		provider === "fcm" || provider === "apns"
			? xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider, token: endpointOrToken },
				})
			: xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider: "webpush", endpoint: endpointOrToken },
				});
