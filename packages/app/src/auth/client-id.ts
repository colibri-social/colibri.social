import { buildScopes } from "@colibri-social/lib";
import { appViewDid, appViewUrl, isDefaultAppView } from "./appview";
import { SIGN_IN_PATH } from "./callback";

export const NATIVE_CLIENT_ORIGIN = "https://spaces.colibri.social";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type ClientLocation = Pick<Location, "hostname" | "host" | "port">;

export const isLoopback = (location: ClientLocation): boolean =>
	LOOPBACK_HOSTS.has(location.hostname);

export const makeClientId = (input: {
	native: boolean;
	location: ClientLocation;
	appView?: string;
}): string => {
	const appView = input.appView ?? appViewUrl();
	const appViewHost = new URL(appView).host;
	const pinned = isDefaultAppView(appView);

	if (input.native) {
		return pinned
			? `${NATIVE_CLIENT_ORIGIN}/oauth-client-metadata-native.json`
			: `${NATIVE_CLIENT_ORIGIN}/c/${appViewHost}/oauth-client-metadata-native.json`;
	}

	if (isLoopback(input.location)) {
		return `http://localhost?${new URLSearchParams({
			scope: buildScopes(appViewDid(appView)).join(" "),
			redirect_uri: `http://127.0.0.1:${input.location.port}${SIGN_IN_PATH}`,
		})}`;
	}

	return pinned
		? `https://${input.location.host}/oauth-client-metadata.json`
		: `https://${input.location.host}/c/${appViewHost}/oauth-client-metadata.json`;
};
