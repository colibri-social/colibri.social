import { colibri } from "../atproto/lexicons";
import type { ColibriClient } from "../atproto/xrpc";
import type { FcmSubscription } from "./push-fcm";
import type { WebPushSubscription } from "./push-web";

export const registerPushWith =
	(xrpc: ColibriClient) =>
	(sub: WebPushSubscription | FcmSubscription): Promise<unknown> =>
		sub.platform === "web"
			? xrpc.push(colibri.notification.registerPush.main, {
					body: {
						provider: "webpush",
						platform: "web",
						endpoint: sub.endpoint,
						p256dh: sub.keys.p256dh,
						auth: sub.keys.auth,
					},
				})
			: xrpc.push(colibri.notification.registerPush.main, {
					body: { provider: "fcm", platform: "android", token: sub.token },
				});

export const unregisterPushWith =
	(xrpc: ColibriClient) =>
	(endpointOrToken: string, provider?: string): Promise<unknown> =>
		provider === "fcm"
			? xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider: "fcm", token: endpointOrToken },
				})
			: xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider: "webpush", endpoint: endpointOrToken },
				});
