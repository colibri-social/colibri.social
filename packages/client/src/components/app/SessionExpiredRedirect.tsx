import { type Component, onMount } from "solid-js";
import { endSession } from "../../atproto/session";
import { createLogger } from "../../utils/logger";
import { AppLoadingScreen } from "../AppLoadingScreen";
import { PENDING_INVITE_KEY } from "./community/invite-storage";

const log = createLogger("session");

const rememberPendingInvite = () => {
	const inviteMatch = window.location.pathname.match(/^\/app\/invite\/([^/]+)/);
	if (!inviteMatch) return;
	try {
		localStorage.setItem(
			PENDING_INVITE_KEY,
			decodeURIComponent(inviteMatch[1]),
		);
	} catch {}
};

export const SessionExpiredRedirect: Component = () => {
	onMount(() => {
		rememberPendingInvite();
		log.info("returning to the sign-in screen");
		void endSession();
	});

	return <AppLoadingScreen message="Taking you to sign in..." />;
};
