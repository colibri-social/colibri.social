import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	advancePending,
	clearPending,
	decideResume,
	RESUME_WINDOW_MS,
	readPending,
	writePending,
} from "./pending-community";

const createLocalStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) =>
			store.has(key) ? (store.get(key) as string) : null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
	};
};

const NS = "did:web:appview:did:plc:owner";

const marker = {
	name: "Birdwatchers",
	requiresApprovalToJoin: true,
	startedAt: 1_000,
	imagesDropped: true,
};

beforeEach(() => {
	vi.stubGlobal("localStorage", createLocalStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the pending-creation marker", () => {
	it("round-trips what the modal needs to resume", () => {
		writePending(NS, marker);

		expect(readPending(NS)).toEqual(marker);
	});

	it("has nothing to say before a creation starts", () => {
		expect(readPending(NS)).toBeUndefined();
	});

	it("keeps namespaces apart", () => {
		writePending(NS, marker);

		expect(readPending("did:web:other:did:plc:owner")).toBeUndefined();
	});

	it("takes the DID from the first progress event that carries one", () => {
		writePending(NS, marker);

		advancePending(NS, "did:plc:community");

		expect(readPending(NS)?.did).toBe("did:plc:community");
	});

	it("ignores a DID when nothing is pending", () => {
		advancePending(NS, "did:plc:community");

		expect(readPending(NS)).toBeUndefined();
	});

	it("forgets the attempt once it is settled", () => {
		writePending(NS, marker);

		clearPending(NS);

		expect(readPending(NS)).toBeUndefined();
	});

	it("drops a marker it cannot read back", () => {
		localStorage.setItem(`colibri:pendingCommunity:${NS}`, "{not json");

		expect(readPending(NS)).toBeUndefined();
	});

	it("drops a marker written by an older shape", () => {
		localStorage.setItem(
			`colibri:pendingCommunity:${NS}`,
			JSON.stringify({ did: "did:plc:community" }),
		);

		expect(readPending(NS)).toBeUndefined();
	});
});

describe("decideResume", () => {
	it("finishes when the caller already holds a member record", () => {
		expect(decideResume({ found: true, isMember: true }, 0)).toBe("done");
	});

	it("waits while the community exists but the membership has not indexed", () => {
		expect(decideResume({ found: true, isMember: false }, 0)).toBe("wait");
	});

	it("waits while the community has not indexed at all", () => {
		expect(decideResume({ found: false }, 0)).toBe("wait");
	});

	it("waits while the AppView cannot answer", () => {
		expect(decideResume({ unknown: true }, 0)).toBe("wait");
	});

	it("gives up on an orphan once the window closes", () => {
		expect(
			decideResume({ found: true, isMember: false }, RESUME_WINDOW_MS),
		).toBe("abandon");
		expect(decideResume({ found: false }, RESUME_WINDOW_MS)).toBe("abandon");
		expect(decideResume({ unknown: true }, RESUME_WINDOW_MS)).toBe("abandon");
	});

	it("still finishes a found community past the window", () => {
		expect(
			decideResume({ found: true, isMember: true }, RESUME_WINDOW_MS * 10),
		).toBe("done");
	});
});
