import { Agent, AtpAgent } from "@atproto/api";
import { ColibriClient } from "../../src/atproto/xrpc";

export const PDS_URL = process.env.COLIBRI_PDS_URL ?? "http://127.0.0.1:3001";

export const APPVIEW_URL =
	process.env.COLIBRI_APPVIEW_URL ?? "http://127.0.0.1:3000";

export const HANDLE_DOMAIN = process.env.COLIBRI_HANDLE_DOMAIN ?? "test";

export const unique = (prefix: string): string =>
	`${prefix}${Math.random().toString(36).slice(2, 10)}`;

const waitFor = async (
	label: string,
	url: string,
	timeoutMs = 30_000,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	let lastError = "no response";

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
			if (res.ok) return;
			lastError = `status ${res.status}`;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(
		`${label} at ${url} did not become reachable within ${timeoutMs}ms (${lastError}). ` +
			"Start the local PDS and AppView first, see packages/client/test/integration/README.md.",
	);
};

export type ServerDescription = {
	did: string;
	software: string;
	flavor: string;
	version: string;
	handleDomain: string;
	pds: string;
};

export const describeAppView = async (): Promise<ServerDescription> => {
	const res = await fetch(
		`${APPVIEW_URL}/xrpc/social.colibri.beta.server.describeServer`,
	);
	if (!res.ok) throw new Error(`describeServer failed with ${res.status}`);
	return (await res.json()) as ServerDescription;
};

export const waitForStack = async (): Promise<ServerDescription> => {
	await waitFor("the PDS", `${PDS_URL}/xrpc/_health`);
	await waitFor(
		"the AppView",
		`${APPVIEW_URL}/xrpc/social.colibri.beta.server.describeServer`,
	);

	const description = await describeAppView();
	if (description.software !== "colibri-appview") {
		throw new Error(
			`${APPVIEW_URL} is not a Colibri AppView (software: ${description.software})`,
		);
	}
	return description;
};

export type TestActor = {
	did: string;
	handle: string;
	password: string;
	agent: Agent;
	xrpc: ColibriClient;
	accessJwt: string;
};

export const createActor = async (
	appViewDid: string,
	prefix = "actor",
): Promise<TestActor> => {
	const atp = new AtpAgent({ service: PDS_URL });
	const handle = `${unique(prefix)}.${HANDLE_DOMAIN}`;
	const password = "integration-password";

	const created = await atp.com.atproto.server.createAccount({
		handle,
		email: `${handle}@example.invalid`,
		password,
	});

	// createAccount does not leave a session on the agent, so the harness has to
	// sign in before anything that needs auth (service auth included) works.
	await atp.login({ identifier: handle, password });

	const agent = new Agent(atp);

	return {
		did: created.data.did,
		handle,
		password,
		agent,
		xrpc: new ColibriClient(agent, appViewDid),
		accessJwt: created.data.accessJwt,
	};
};

export const serviceAuthToken = async (
	actor: TestActor,
	lxm: string,
	aud: string,
): Promise<string> => {
	const { data } = await actor.agent.com.atproto.server.getServiceAuth({
		aud,
		lxm,
		exp: Math.floor(Date.now() / 1000) + 60,
	});
	return data.token;
};
