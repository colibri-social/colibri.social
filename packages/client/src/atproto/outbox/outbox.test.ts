import { beforeEach, describe, expect, it, vi } from "vitest";

const SPACE = "at://did:plc:abc123/space/social.colibri.beta.channel.text/one";
const SOURCE = "at://did:plc:abc123/space/social.colibri.beta.channel.text/two";
const REPO = "did:plc:abc123";
const COLLECTION = "social.colibri.beta.message";

const createRecord = vi.fn();
const deleteRecord = vi.fn();

let stored: Map<number, unknown>;
let nextSeq: number;

vi.mock("../session-health", () => ({ sessionDead: () => false }));

vi.mock("../../errors/report", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	reportError: () => undefined,
}));

vi.mock("../../errors/show-error", () => ({ showError: () => undefined }));

vi.mock("../cache/store", () => ({
	outboxAppend: (entry: unknown) => {
		const seq = nextSeq++;
		stored.set(seq, entry);
		return Promise.resolve(seq);
	},
	outboxAll: () =>
		Promise.resolve([...stored].map(([seq, entry]) => ({ seq, entry }))),
	outboxUpdate: (seq: number, entry: unknown) => {
		stored.set(seq, entry);
		return Promise.resolve();
	},
	outboxDelete: (seq: number) => {
		stored.delete(seq);
		return Promise.resolve();
	},
}));

const agent = {
	com: {
		atproto: {
			space: {
				createRecord: (...args: unknown[]) => createRecord(...args),
				deleteRecord: (...args: unknown[]) => deleteRecord(...args),
			},
		},
	},
};

const load = async () => {
	const module = await import("./outbox");
	await module.initOutbox(agent as never, "owner");
	return module;
};

beforeEach(() => {
	vi.resetModules();
	createRecord.mockReset();
	deleteRecord.mockReset();
	createRecord.mockResolvedValue({});
	deleteRecord.mockResolvedValue({});
	stored = new Map();
	nextSeq = 1;
});

describe("grouped writes", () => {
	it("drops the source delete when the destination create fails for good", async () => {
		createRecord.mockRejectedValue({ status: 400 });
		const outbox = await load();

		await outbox.enqueueSpaceCreate(
			SPACE,
			REPO,
			COLLECTION,
			{ text: "hi" },
			{
				rkey: "3lb",
				group: "move:3lb",
			},
		);
		await outbox.enqueueSpaceDelete(SOURCE, REPO, COLLECTION, "3la", {
			group: "move:3lb",
		});
		await outbox.flush();

		expect(createRecord).toHaveBeenCalledTimes(1);
		expect(deleteRecord).not.toHaveBeenCalled();
		expect(outbox.pendingCount()).toBe(0);
	});

	it("keeps a delete from another group when one create fails", async () => {
		createRecord.mockRejectedValueOnce({ status: 400 });
		const outbox = await load();

		await outbox.enqueueSpaceCreate(
			SPACE,
			REPO,
			COLLECTION,
			{ text: "one" },
			{
				rkey: "3lb",
				group: "move:3lb",
			},
		);
		await outbox.enqueueSpaceDelete(SOURCE, REPO, COLLECTION, "3la", {
			group: "move:3lb",
		});
		await outbox.enqueueSpaceCreate(
			SPACE,
			REPO,
			COLLECTION,
			{ text: "two" },
			{
				rkey: "3ld",
				group: "move:3ld",
			},
		);
		await outbox.enqueueSpaceDelete(SOURCE, REPO, COLLECTION, "3lc", {
			group: "move:3ld",
		});
		await outbox.flush();

		expect(deleteRecord).toHaveBeenCalledTimes(1);
		expect(deleteRecord.mock.calls[0]?.[0]).toMatchObject({ rkey: "3lc" });
	});

	it("runs the source delete once the destination create lands", async () => {
		const outbox = await load();

		await outbox.enqueueSpaceCreate(
			SPACE,
			REPO,
			COLLECTION,
			{ text: "hi" },
			{
				rkey: "3lb",
				group: "move:3lb",
			},
		);
		await outbox.enqueueSpaceDelete(SOURCE, REPO, COLLECTION, "3la", {
			group: "move:3lb",
		});
		await outbox.flush();

		expect(createRecord).toHaveBeenCalledTimes(1);
		expect(deleteRecord).toHaveBeenCalledTimes(1);
	});

	it("leaves ungrouped writes alone when one fails", async () => {
		createRecord.mockRejectedValue({ status: 400 });
		const outbox = await load();

		await outbox.enqueueSpaceCreate(
			SPACE,
			REPO,
			COLLECTION,
			{ text: "hi" },
			{
				rkey: "3lb",
			},
		);
		await outbox.enqueueSpaceDelete(SOURCE, REPO, COLLECTION, "3la");
		await outbox.flush();

		expect(deleteRecord).toHaveBeenCalledTimes(1);
	});
});
