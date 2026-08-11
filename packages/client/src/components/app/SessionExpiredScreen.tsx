import { type Component, onMount, Show } from "solid-js";
import { endSession } from "../../atproto/session";
import { sessionDeadCode } from "../../atproto/session-health";
import { copyForCode, type ErrorCopy } from "../../errors/copy";
import { createLogger } from "../../utils/logger";
import { Button } from "../ui/Button";
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

const SIGNED_OUT_COPY: ErrorCopy = {
	title: "You're not signed in.",
	description: "Sign in to pick up where you left off.",
};

export const SessionExpiredScreen: Component = () => {
	const copy = () => {
		const code = sessionDeadCode();
		return code ? copyForCode(code) : SIGNED_OUT_COPY;
	};

	onMount(() => {
		rememberPendingInvite();
		log.info("waiting for the user to sign in again");
	});

	return (
		<div class="w-full h-full fixed top-0 left-0 z-70 bg-background flex flex-col items-center justify-center gap-3 px-6 text-foreground select-none">
			<p class="text-base font-medium m-0 text-center">{copy().title}</p>
			<Show when={copy().description}>
				<p class="text-sm text-muted-foreground m-0 text-center">
					{copy().description}
				</p>
			</Show>
			<Button class="mt-1" onClick={() => void endSession()}>
				Sign in
			</Button>
		</div>
	);
};
