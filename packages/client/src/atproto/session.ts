import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { unregisterAllPush } from "../notifications";
import { unregisterPushWith } from "../notifications/push-xrpc";
import { clearAppBadge } from "../utils/badge";
import { clearUserScoped } from "./cache/store";
import { beginSignOut } from "./session-health";
import type { ColibriClient } from "./xrpc";

const LOGIN_PATH = "/app/login";

let ending = false;

export const endSession = async (): Promise<void> => {
	if (ending) return;
	ending = true;

	beginSignOut();
	await clearAppBadge();
	localStorage.removeItem("sub");
	await clearUserScoped();

	if (window.location.pathname === LOGIN_PATH) {
		ending = false;
		return;
	}

	window.location.replace(LOGIN_PATH);
};

export const signOut = async (input: {
	xrpc: ColibriClient;
	client: BrowserOAuthClient | undefined;
	did: string;
}): Promise<void> => {
	beginSignOut();

	try {
		await unregisterAllPush(unregisterPushWith(input.xrpc));
		await input.client?.revoke(input.did);
	} finally {
		await endSession();
	}
};
