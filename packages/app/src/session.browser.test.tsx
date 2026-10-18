import type { Agent } from "@atproto/api";
import { createRoot } from "solid-js";
import { afterEach, expect, it } from "vitest";
import type { Auth } from "./auth";
import { createSignedInSession } from "./session";

const DID = "did:plc:startup-hang";

let disposeRoot: (() => void) | undefined;

afterEach(() => {
	disposeRoot?.();
	disposeRoot = undefined;
});

const hangingAuth = () => {
	const agent = {
		did: DID,
		fetchHandler: () => new Promise<Response>(() => {}),
	} as unknown as Agent;
	return {
		agent: () => agent,
		status: () => "signedIn",
		onAuthFailure: () => {},
		health: { dead: () => false },
	} as unknown as Auth;
};

it("fails with a retry when the first data never arrives", async () => {
	const session = createRoot((dispose) => {
		disposeRoot = dispose;
		return createSignedInSession(hangingAuth(), { startTimeoutMs: 60 });
	});
	expect(session.state().kind).toBe("loading");
	await expect
		.poll(() => session.state().kind, { timeout: 3000 })
		.toBe("failed");
	const state = session.state();
	expect(state.kind === "failed" && state.error.code).toBe("Timeout");
	session.retry();
	expect(session.state().kind).toBe("loading");
	await expect
		.poll(() => session.state().kind, { timeout: 3000 })
		.toBe("failed");
});
