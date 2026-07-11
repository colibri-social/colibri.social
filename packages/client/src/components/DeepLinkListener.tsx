import { useNavigate } from "@solidjs/router";
import { type Component, onCleanup, onMount } from "solid-js";
import { completeNativeOAuth } from "../atproto/auth";
import { useAuthContext } from "../contexts/Auth";
import { isTauriRuntime } from "../notifications/environment";

/** True for the native OAuth callback deep link (`social.colibri:/oauth/...`) */
const isOAuthCallback = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === "social.colibri:" &&
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

/**
 * Headless component that routes incoming Tauri deep links:
 * - `social.colibri:/oauth/callback?...` — finishes the external-browser OAuth
 *   sign-in (see startOAuthSignIn in auth.ts), then reloads into the app.
 * - `social.colibri:/invite/<code>` — opens the in-app invite screen, driving
 *   the existing join / pre-login pending-invite flow (InviteModal + AppLayout).
 *
 * Renders nothing and is a no-op outside the Tauri runtime, so it's safe to
 * mount in the shared client on the web too
 */
export const DeepLinkListener: Component = () => {
	const navigate = useNavigate();
	const auth = useAuthContext();

	onMount(() => {
		if (!isTauriRuntime()) return;

		let disposed = false;
		let unlisten: (() => void) | undefined;

		const route = async (urls: readonly string[] | null) => {
			if (!urls) return;
			for (const url of urls) {
				if (isOAuthCallback(url)) {
					try {
						if (auth && (await completeNativeOAuth(auth.client, url))) {
							// Reload so the auth bootstrap picks up the restored session.
							window.location.href = "/app";
							return;
						}
					} catch (err) {
						console.error("[deep-link] OAuth callback failed", err);
					}
					continue;
				}

				const code = parseInviteCode(url);
				if (code) {
					navigate(`/app/invite/${code}`);
					return;
				}
			}
		};

		void (async () => {
			const { getCurrent, onOpenUrl } = await import(
				"@tauri-apps/plugin-deep-link"
			);
			// A URL the app was cold-launched with, then any received while running.
			try {
				await route(await getCurrent());
			} catch {}
			if (disposed) return;
			unlisten = await onOpenUrl((urls) => void route(urls));
		})();

		onCleanup(() => {
			disposed = true;
			unlisten?.();
		});
	});

	return null;
};
