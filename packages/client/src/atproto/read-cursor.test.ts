import type { Agent } from "@atproto/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColibriClient } from "./xrpc";

const { enqueueSpacePut } = vi.hoisted(() => ({
	enqueueSpacePut: vi.fn((..._args: unknown[]) =>
		Promise.resolve({ uri: "at://x" }),
	),
}));

vi.mock("./outbox/outbox", () => ({ enqueueSpacePut }));

const {
	configureReadCursorWriter,
	resetReadCursorWriter,
	recordRead,
	adoptRemoteCursors,
	flushReadCursors,
	bumpCursor,
	recallReadCursor,
	MAX_INTERVAL_MS,
	DEBOUNCE_MS,
} = await import("./read-cursor");

const ACTOR = "did:plc:me";
const COMMUNITY_A = "did:plc:community-a";
const COMMUNITY_B = "did:plc:community-b";

const flushMicrotasks = async (): Promise<void> => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};

const settleDebounce = async (): Promise<void> => {
	await flushMicrotasks();
	await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
	await flushMicrotasks();
};

type PutArgs = [
	string,
	string,
	string,
	string,
	{ cursors: Array<{ channel: string; cursor: string }> },
];

const lastPut = () => enqueueSpacePut.mock.calls.at(-1) as unknown as PutArgs;

describe("read-cursor debounce policy", () => {
	let getRecord: ReturnType<typeof vi.fn>;
	let call: ReturnType<typeof vi.fn>;
	let agent: Agent;
	let xrpc: ColibriClient;

	beforeEach(() => {
		vi.useFakeTimers();
		enqueueSpacePut.mockClear();
		getRecord = vi.fn(() =>
			Promise.reject(
				Object.assign(new Error("not found"), { error: "RecordNotFound" }),
			),
		);
		call = vi.fn(() => Promise.resolve({ ok: true, data: { statuses: [] } }));
		agent = {
			com: { atproto: { space: { getRecord } } },
		} as unknown as Agent;
		xrpc = { call } as unknown as ColibriClient;
		configureReadCursorWriter({ agent, xrpc, actorDid: ACTOR });
	});

	afterEach(() => {
		resetReadCursorWriter();
		vi.useRealTimers();
	});

	it("writes the first read in a community immediately", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await flushMicrotasks();

		expect(enqueueSpacePut).toHaveBeenCalledTimes(1);
		const [space, repo, collection, rkey, record] = lastPut();
		expect(space).toContain(ACTOR);
		expect(repo).toBe(ACTOR);
		expect(collection).toBe("social.colibri.beta.channel.read");
		expect(rkey).toBe(COMMUNITY_A);
		expect(record.cursors).toEqual([
			{ channel: "general", cursor: "3jz1a2b3c4d5e" },
		]);
	});

	it("announces the write to the appview", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await flushMicrotasks();

		expect(call).toHaveBeenCalledTimes(1);
		const [, input] = call.mock.calls[0]!;
		expect(input.body.community).toBe(COMMUNITY_A);
		expect(input.body.cursors).toEqual([
			{ channel: "general", cursor: "3jz1a2b3c4d5e" },
		]);
	});

	it("defers a read that follows shortly after the first, then writes the full merged state", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		await flushMicrotasks();
		enqueueSpacePut.mockClear();

		recordRead(COMMUNITY_A, "random", "3jz1a2b3c4d5b");
		await flushMicrotasks();

		expect(enqueueSpacePut).not.toHaveBeenCalled();

		await settleDebounce();

		expect(enqueueSpacePut).toHaveBeenCalledTimes(1);
		const [, , , , record] = lastPut();
		expect(record.cursors).toEqual(
			expect.arrayContaining([
				{ channel: "general", cursor: "3jz1a2b3c4d5a" },
				{ channel: "random", cursor: "3jz1a2b3c4d5b" },
			]),
		);
	});

	it("keeps extending the debounce window under continuous reads, but never past the max interval", async () => {
		const timestamps: number[] = [];
		enqueueSpacePut.mockImplementation((..._args: unknown[]) => {
			timestamps.push(Date.now());
			return Promise.resolve({ uri: "at://x" });
		});

		for (let i = 0; i < 40; i++) {
			recordRead(
				COMMUNITY_A,
				"general",
				`tid-${i.toString().padStart(3, "0")}`,
			);
			await flushMicrotasks();
			await vi.advanceTimersByTimeAsync(200);
			await flushMicrotasks();
		}
		await settleDebounce();

		expect(timestamps.length).toBeGreaterThan(1);
		expect(timestamps.length).toBeLessThan(40);
		for (let i = 1; i < timestamps.length; i++) {
			expect(timestamps[i]! - timestamps[i - 1]!).toBeLessThanOrEqual(
				MAX_INTERVAL_MS + DEBOUNCE_MS,
			);
		}
	});

	it("does not regress a channel's cursor to an older TID", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5b");
		await flushMicrotasks();
		enqueueSpacePut.mockClear();

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		await settleDebounce();

		expect(enqueueSpacePut).not.toHaveBeenCalled();
	});

	it("keeps each community on its own coalescing window", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		recordRead(COMMUNITY_B, "general", "3jz1a2b3c4d5a");
		await settleDebounce();

		expect(enqueueSpacePut).toHaveBeenCalledTimes(2);
		const rkeys = enqueueSpacePut.mock.calls.map((c) => c[3] as string);
		expect(rkeys.sort()).toEqual([COMMUNITY_A, COMMUNITY_B].sort());
	});

	it("flushReadCursors writes a pending community immediately, skipping the debounce", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		await flushMicrotasks();
		enqueueSpacePut.mockClear();

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5b");
		await flushMicrotasks();
		expect(enqueueSpacePut).not.toHaveBeenCalled();

		flushReadCursors();
		await flushMicrotasks();

		expect(enqueueSpacePut).toHaveBeenCalledTimes(1);
	});

	it("is a no-op to flush when nothing is pending", () => {
		expect(() => flushReadCursors()).not.toThrow();
		expect(enqueueSpacePut).not.toHaveBeenCalled();
	});

	it("merges a new channel's cursor with what the PDS already had", async () => {
		getRecord.mockImplementation(() =>
			Promise.resolve({
				data: {
					value: {
						community: COMMUNITY_A,
						cursors: [{ channel: "announcements", cursor: "3jz1a2b3c4d0a" }],
					},
				},
			}),
		);

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await settleDebounce();

		const [, , , , record] = lastPut();
		expect(record.cursors).toEqual(
			expect.arrayContaining([
				{ channel: "announcements", cursor: "3jz1a2b3c4d0a" },
				{ channel: "general", cursor: "3jz1a2b3c4d5e" },
			]),
		);
	});

	it("adopts a newer cursor from the appview without writing it back", async () => {
		adoptRemoteCursors(COMMUNITY_A, [
			{ channel: "general", cursor: "3jz1a2b3c4d5b" },
		]);
		await settleDebounce();

		expect(enqueueSpacePut).not.toHaveBeenCalled();

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		await settleDebounce();

		expect(enqueueSpacePut).not.toHaveBeenCalled();
	});

	it("ignores an adopted cursor that is older than what it already holds", async () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5b");
		await flushMicrotasks();
		enqueueSpacePut.mockClear();

		adoptRemoteCursors(COMMUNITY_A, [
			{ channel: "general", cursor: "3jz1a2b3c4d5a" },
		]);
		recordRead(COMMUNITY_A, "random", "3jz1a2b3c4d5c");
		await settleDebounce();

		const [, , , , record] = lastPut();
		expect(record.cursors).toEqual(
			expect.arrayContaining([
				{ channel: "general", cursor: "3jz1a2b3c4d5b" },
				{ channel: "random", cursor: "3jz1a2b3c4d5c" },
			]),
		);
	});

	it("carries another device's adopted cursor into the next full push", async () => {
		adoptRemoteCursors(COMMUNITY_A, [
			{ channel: "announcements", cursor: "3jz1a2b3c4d9z" },
		]);

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await settleDebounce();

		const [, , , , record] = lastPut();
		expect(record.cursors).toEqual(
			expect.arrayContaining([
				{ channel: "announcements", cursor: "3jz1a2b3c4d9z" },
				{ channel: "general", cursor: "3jz1a2b3c4d5e" },
			]),
		);
	});

	it("stays quiet once the writer has been reset", async () => {
		resetReadCursorWriter();

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await flushMicrotasks();
		await vi.advanceTimersByTimeAsync(MAX_INTERVAL_MS);
		await flushMicrotasks();

		expect(enqueueSpacePut).not.toHaveBeenCalled();
	});
});

describe("synchronous cursor reads", () => {
	let getRecord: ReturnType<typeof vi.fn>;
	let agent: Agent;
	let xrpc: ColibriClient;

	beforeEach(() => {
		vi.useFakeTimers();
		enqueueSpacePut.mockClear();
		getRecord = vi.fn(() =>
			Promise.reject(
				Object.assign(new Error("not found"), { error: "RecordNotFound" }),
			),
		);
		agent = {
			com: { atproto: { space: { getRecord } } },
		} as unknown as Agent;
		xrpc = {
			call: vi.fn(() => Promise.resolve({ ok: true, data: { statuses: [] } })),
		} as unknown as ColibriClient;
		configureReadCursorWriter({ agent, xrpc, actorDid: ACTOR });
	});

	afterEach(() => {
		resetReadCursorWriter();
		vi.useRealTimers();
	});

	it("has nothing to recall for an unknown community", () => {
		expect(recallReadCursor(COMMUNITY_A, "general")).toBeUndefined();
	});

	it("recalls a read the moment it is recorded, without awaiting hydration", () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");

		expect(recallReadCursor(COMMUNITY_A, "general")).toBe("3jz1a2b3c4d5e");
	});

	it("recalls a cursor adopted from the appview", () => {
		adoptRemoteCursors(COMMUNITY_A, [
			{ channel: "general", cursor: "3jz1a2b3c4d5b" },
		]);

		expect(recallReadCursor(COMMUNITY_A, "general")).toBe("3jz1a2b3c4d5b");
	});

	it("keeps communities and channels apart", () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");

		expect(recallReadCursor(COMMUNITY_B, "general")).toBeUndefined();
		expect(recallReadCursor(COMMUNITY_A, "random")).toBeUndefined();
	});

	it("forgets everything once the writer has been reset", () => {
		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		resetReadCursorWriter();

		expect(recallReadCursor(COMMUNITY_A, "general")).toBeUndefined();
	});

	it("reports whether a bump advanced the cursor", () => {
		expect(bumpCursor(COMMUNITY_A, "general", "3jz1a2b3c4d5b")).toBe(true);
		expect(bumpCursor(COMMUNITY_A, "general", "3jz1a2b3c4d5a")).toBe(false);
		expect(bumpCursor(COMMUNITY_A, "general", "3jz1a2b3c4d5b")).toBe(false);
		expect(bumpCursor(COMMUNITY_A, "general", "3jz1a2b3c4d5c")).toBe(true);
		expect(recallReadCursor(COMMUNITY_A, "general")).toBe("3jz1a2b3c4d5c");
	});

	it("yields to a newer cursor found on the PDS, and does not write", async () => {
		getRecord.mockImplementation(() =>
			Promise.resolve({
				data: {
					value: {
						community: COMMUNITY_A,
						cursors: [{ channel: "general", cursor: "3jz1a2b3c4d9z" }],
					},
				},
			}),
		);

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5a");
		await settleDebounce();

		expect(recallReadCursor(COMMUNITY_A, "general")).toBe("3jz1a2b3c4d9z");
		expect(enqueueSpacePut).not.toHaveBeenCalled();
	});

	it("still writes when the PDS record is behind the recorded read", async () => {
		getRecord.mockImplementation(() =>
			Promise.resolve({
				data: {
					value: {
						community: COMMUNITY_A,
						cursors: [{ channel: "general", cursor: "3jz1a2b3c4d0a" }],
					},
				},
			}),
		);

		recordRead(COMMUNITY_A, "general", "3jz1a2b3c4d5e");
		await settleDebounce();

		expect(recallReadCursor(COMMUNITY_A, "general")).toBe("3jz1a2b3c4d5e");
		expect(enqueueSpacePut).toHaveBeenCalledTimes(1);
	});
});
