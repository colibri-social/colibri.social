import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../errors/report"), async (importOriginal) => ({
	...(await importOriginal()),
	reportError: vi.fn(),
}));

const load = async () => {
	vi.resetModules();
	const { initSessionDebug } = await import("./session-debug");
	const health = await import("./session-health");
	initSessionDebug();
	const debug = window.__colibriSession;
	if (!debug) throw new Error("the debug hook was not installed");
	return { debug, ...health };
};

beforeEach(() => {
	vi.stubGlobal("window", {});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("__colibriSession", () => {
	it("reports a live session before anything goes wrong", async () => {
		const { debug } = await load();
		expect(debug.state()).toEqual({ dead: false, code: undefined });
	});

	it("ends the session on expire and hands back the new state", async () => {
		const { debug, sessionDead, sessionDeadCode } = await load();
		expect(debug.expire()).toEqual({ dead: true, code: "ExpiredToken" });
		expect(sessionDead()).toBe(true);
		expect(sessionDeadCode()).toBe("ExpiredToken");
	});

	it("takes the code it was handed", async () => {
		const { debug } = await load();
		expect(debug.expire("InvalidToken").code).toBe("InvalidToken");
	});

	it("needs three soft failures before the session gives up", async () => {
		const { debug } = await load();
		expect(debug.fail().dead).toBe(false);
		expect(debug.fail().dead).toBe(false);
		expect(debug.fail().dead).toBe(true);
	});
});
