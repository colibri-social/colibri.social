import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

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
	Promise<XrpcResult<Response>>
> = async (fetch, subscription) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.notification.registerPush",
		route: `/xrpc/social.colibri.notification.registerPush`,
		init: {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(toWireBody(subscription)),
		},
	});
};
