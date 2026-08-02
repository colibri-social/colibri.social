import { useNavigate } from "@solidjs/router";
import { type Component, onCleanup, onMount } from "solid-js";
import { completeNativeOAuth } from "../atproto/auth";
import { useAuthContext } from "../contexts/Auth";
import { classifyThrown } from "../errors/classify";
import { isSignInDenial } from "../errors/oauth";
import { showError } from "../errors/show-error";
import { isTauriRuntime } from "../notifications/environment";
import { createLogger } from "../utils/logger";

const log = createLogger("deep-link");

/** True for a native OAuth callback deep link (`social.colibri[.*]:/oauth/...`) */
const isOAuthCallback = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol.startsWith("social.colibri") &&
			parsed.pathname.startsWith("/oauth")
		);
	} catch {
		return false;
	}
};

/** Extract an invite code from a `social.colibri:/invite/<code>` deep link */
const parseInviteCode = (url: string): string | null => {
	try {
		const parsed = new URL(url);
		const segments = [parsed.host, ...parsed.pathname.split("/")].filter(
			Boolean,
		);
		const idx = segments.indexOf("invite");
		const code = idx !== -1 ? segments[idx + 1] : undefined;
		return code ? decodeURIComponent(code) : null;
	} catch {
		return null;
	}
};

type ChannelDeepLink = {
	community: string;
	channelType: string;
	channel: string;
};

const parseChannelDeepLink = (url: string): ChannelDeepLink | null => {
	try {
		const parsed = new URL(url);
		const segments = [parsed.host, ...parsed.pathname.split("/")].filter(
			Boolean,
		);
		const idx = segments.indexOf("channel");
		if (idx === -1) return null;
		const [community, channelType, channel] = segments.slice(idx + 1);
		if (!community || !channelType || !channel) return null;
		return {
			community: decodeURIComponent(community),
			channelType: decodeURIComponent(channelType),
			channel: decodeURIComponent(channel),
		};
	} catch {
		return null;
	}
};

const deepLinkPluginPromise = isTauriRuntime()
	? import("@tauri-apps/plugin-deep-link")
	: undefined;

const HANDLED_STORAGE_KEY = "colibri:handled-deep-link";

const markHandled = (url: string): void => {
	try {
		sessionStorage.setItem(HANDLED_STORAGE_KEY, url);
	} catch {}
};

const wasHandled = (url: string): boolean => {
	try {
		return sessionStorage.getItem(HANDLED_STORAGE_KEY) === url;
	} catch {
		return false;
	}
};

/**
 * Headless component that routes incoming Tauri deep links:
 * - `social.colibri:/oauth/callback?...` — finishes the external-browser OAuth
 *   sign-in (see startOAuthSignIn in auth.ts), then reloads into the app.
 * - `social.colibri:/invite/<code>` — opens the in-app invite screen, driving
 *   the existing join / pre-login pending-invite flow (InviteModal + AppLayout).
 * - `social.colibri:/channel/<community>/<channelType>/<channel>` — opens a
 *   specific channel, e.g. from tapping an Android push notification (see
 *   `ColibriFirebaseMessagingService`'s tap `PendingIntent`).
 *
 * Renders nothing and is a no-op outside the Tauri runtime, so it's safe to
 * mount in the shared client on the web too
 */
export const DeepLinkListener: Component = () => {
	const navigate = useNavigate();
	const auth = useAuthContext();

	onMount(() => {
		if (!isTauriRuntime() || !deepLinkPluginPromise) return;

		let disposed = false;
		let unlisten: (() => void) | undefined;

		const route = async (urls: readonly string[] | null) => {
			log.debug("received deep links", { count: urls?.length ?? 0 });
			if (!urls) return;
			for (const url of urls) {
				markHandled(url);

				if (isOAuthCallback(url)) {
					try {
						if (auth && (await completeNativeOAuth(auth.client, url))) {
							// Reload so the auth bootstrap picks up the restored session.
							window.location.replace("/app");
							return;
						}
					} catch (err) {
						log.error("the OAuth callback failed", {
							code: classifyThrown(err).code,
						});
						showError(err, {
							stage: "oauth.native-callback",
							report: !isSignInDenial(err),
						});
					}
					continue;
				}

				const code = parseInviteCode(url);
				if (code) {
					navigate(`/app/invite/${code}`);
					return;
				}

				const channelLink = parseChannelDeepLink(url);
				if (channelLink) {
					navigate(
						`/app/c/${channelLink.community}/${channelLink.channelType}/${channelLink.channel}`,
					);
					return;
				}
			}
		};

		void (async () => {
			const { getCurrent, onOpenUrl } = await deepLinkPluginPromise;
			if (disposed) return;
			// Subscribe before pulling the cold-launch URL, so a deep link that
			// arrives while we're still starting up isn't missed.
			unlisten = await onOpenUrl((urls) => void route(urls));
			if (disposed) return;
			log.debug("subscribed to deep links");
			try {
				const current = await getCurrent();
				await route(current?.filter((url) => !wasHandled(url)) ?? null);
			} catch {}
		})().catch((err) => {
			log.error("could not subscribe to deep links", {
				code: classifyThrown(err).code,
			});
		});

		onCleanup(() => {
			disposed = true;
			unlisten?.();
		});
	});

	return null;
};
