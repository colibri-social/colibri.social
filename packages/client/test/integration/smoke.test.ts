import { beforeAll, describe, expect, it } from "vitest";
import { colibri } from "../../src/atproto/lexicons";
import {
	createActor,
	type ServerDescription,
	type TestActor,
	waitForStack,
} from "./harness";

let server: ServerDescription;
let alice: TestActor;

beforeAll(async () => {
	server = await waitForStack();
	alice = await createActor(server.did, "alice");
});

describe("the local stack", () => {
	it("describes itself as a Colibri AppView", () => {
		expect(server.software).toBe("colibri-appview");
		expect(server.flavor.length).toBeGreaterThan(0);
		expect(server.did.startsWith("did:web:")).toBe(true);
		expect(server.pds.length).toBeGreaterThan(0);
	});
});

describe("actor.getProfile", () => {
	it("serves the account the client just created", async () => {
		const res = await alice.xrpc.call(colibri.actor.getProfile.main, {
			params: { actor: alice.did },
		});

		if (!res.ok) {
			throw new Error(
				`getProfile failed: ${res.error.code} ${res.error.status ?? ""} ${res.error.serverMessage ?? ""}`,
			);
		}
		expect(res.data.profile.did).toBe(alice.did);
		// A `.test` handle has no DNS or well-known record locally, so the
		// AppView correctly reports the documented fallback instead.
		expect([alice.handle, "handle.invalid"]).toContain(res.data.profile.handle);
	});
});
