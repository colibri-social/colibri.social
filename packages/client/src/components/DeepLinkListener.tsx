import { useNavigate } from "@solidjs/router";
import { type Component, onCleanup, onMount } from "solid-js";
import { isTauriRuntime } from "../notifications/environment";

/**
 * Extract an invite code from a deep-link URL. Handles the custom scheme
 * `colibri://invite/<code>` (where `invite` is parsed as the URL host) as well
 * as any `.../invite/<code>` path form
 */
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
 * Headless component that routes incoming Tauri deep links. Currently handles
 * community invites (`colibri://invite/<code>`) by navigating to the in-app
 * invite screen, which drives the existing join / pre-login pending-invite flow
 * (see InviteModal + AppLayout). Renders nothing and is a no-op outside the
 * Tauri runtime
 */
export const DeepLinkListener: Component = () => {
	const navigate = useNavigate();

	onMount(() => {
		if (!isTauriRuntime()) return;

		let disposed = false;
		let unlisten: (() => void) | undefined;

		const route = (urls: readonly string[] | null) => {
			if (!urls) return;
			for (const url of urls) {
				const code = parseInviteCode(url);
				if (code) {
					navigate(`/app/invite/${code}`);
					return;
				}
			}
		};

		void (async () => {
			const { getCurrent, onOpenUrl } =
				await import("@tauri-apps/plugin-deep-link");
			// A URL the app was cold-launched with, then any received while running.
			try {
				route(await getCurrent());
			} catch {}
			if (disposed) return;
			unlisten = await onOpenUrl((urls) => route(urls));
		})();

		onCleanup(() => {
			disposed = true;
			unlisten?.();
		});
	});

	return null;
};
