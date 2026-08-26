import { beforeEach, describe, expect, it, vi } from "vitest";

const SPACE = "at://did:plc:abc123/space/social.colibri.beta.channel.text/one";
const OTHER_SPACE =
	"at://did:plc:abc123/space/social.colibri.beta.channel.text/two";
const REPO = "did:plc:abc123";

const uploadBlob = vi.fn();
const enqueueSpaceCreate = vi.fn();

let stored: Map<number, unknown>;
let nextSeq: number;

vi.mock("../pds", () => ({
	uploadBlob: (...args: unknown[]) => uploadBlob(...args),
}));

vi.mock("./outbox", () => ({
	enqueueSpaceCreate: (...args: unknown[]) => enqueueSpaceCreate(...args),
	onOutboxSent: () => () => undefined,
}));

vi.mock("../session-health", () => ({ sessionDead: () => false }));

vi.mock("../../errors/report", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	reportError: () => undefined,
}));

vi.mock("../../errors/show-error", () => ({ showError: () => undefined }));

vi.mock("../cache/store", () => ({
	sendsAppend: (entry: unknown) => {
		const seq = nextSeq++;
		stored.set(seq, entry);
		return Promise.resolve(seq);
	},
	sendsAll: () =>
		Promise.resolve([...stored].map(([seq, entry]) => ({ seq, entry }))),
	sendsUpdate: (seq: number, entry: unknown) => {
		stored.set(seq, entry);
		return Promise.resolve();
	},
	sendsDelete: (seq: number) => {
		stored.delete(seq);
		return Promise.resolve();
	},
}));

const blobRef = (id: string) => ({ toJSON: () => ({ $type: "blob", id }) });

const load = async () => {
	const module = await import("./sends");
	await module.initSends({} as never, "owner");
	return module;
};

const file = (name: string) => new File([name], name, { type: "text/plain" });

const enqueue = (
	module: Awaited<ReturnType<typeof load>>,
	files: File[],
	space = SPACE,
) =>
	module.enqueueMessageSend({
		space,
		repo: REPO,
		text: "hello",
		facets: [],
		files,
		suppressedEmbeds: [],
	});

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	uploadBlob.mockReset();
	enqueueSpaceCreate.mockReset();
	enqueueSpaceCreate.mockResolvedValue({ uri: "at://sent" });
	stored = new Map();
	nextSeq = 1;
	Object.assign(globalThis.URL, {
		createObjectURL: () => "blob:stub",
		revokeObjectURL: () => undefined,
	});
});

describe("the send queue", () => {
	it("re-uploads only the file that failed", async () => {
		uploadBlob.mockImplementation((_agent: unknown, target: File) =>
			target.name === "b" && uploadBlob.mock.calls.length <= 3
				? Promise.reject(new Error("network went away"))
				: Promise.resolve(blobRef(target.name)),
		);

		const module = await load();
		await enqueue(module, [file("a"), file("b"), file("c")]);
		await vi.advanceTimersByTimeAsync(0);

		expect(uploadBlob).toHaveBeenCalledTimes(3);
		expect(enqueueSpaceCreate).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(5_000);

		expect(uploadBlob).toHaveBeenCalledTimes(4);
		expect(uploadBlob.mock.calls[3]?.[1]?.name).toBe("b");
		expect(enqueueSpaceCreate).toHaveBeenCalledTimes(1);

		const record = enqueueSpaceCreate.mock.calls[0]?.[3] as {
			attachments: Array<{ name: string }>;
		};
		expect(record.attachments.map((a) => a.name)).toEqual(["a", "b", "c"]);
	});

	it("writes to the space captured at enqueue time", async () => {
		uploadBlob.mockImplementation((_agent: unknown, target: File) =>
			Promise.resolve(blobRef(target.name)),
		);

		const module = await load();
		await enqueue(module, [file("a")], OTHER_SPACE);
		await enqueue(module, [file("b")], SPACE);
		await vi.advanceTimersByTimeAsync(0);

		expect(enqueueSpaceCreate).toHaveBeenCalledTimes(2);
		expect(enqueueSpaceCreate.mock.calls[0]?.[0]).toBe(OTHER_SPACE);
		expect(enqueueSpaceCreate.mock.calls[1]?.[0]).toBe(SPACE);
	});

	it("projects a queued send into the channel it was written for", async () => {
		uploadBlob.mockImplementation(() => new Promise(() => undefined));

		const module = await load();
		await enqueue(module, [file("a")]);
		await vi.advanceTimersByTimeAsync(0);

		expect(module.pendingSends(SPACE)).toHaveLength(1);
		expect(module.pendingSends(OTHER_SPACE)).toHaveLength(0);
	});

	it("survives a restart with the refs it already collected", async () => {
		uploadBlob.mockImplementation((_agent: unknown, target: File) =>
			target.name === "b"
				? Promise.reject(new Error("network went away"))
				: Promise.resolve(blobRef(target.name)),
		);

		const first = await load();
		const queued = await enqueue(first, [file("a"), file("b")]);
		await vi.advanceTimersByTimeAsync(0);

		vi.resetModules();
		uploadBlob.mockImplementation((_agent: unknown, target: File) =>
			Promise.resolve(blobRef(target.name)),
		);

		const second = await load();
		expect(second.pendingSends(SPACE)).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(0);

		expect(enqueueSpaceCreate).toHaveBeenCalledTimes(1);
		expect(enqueueSpaceCreate.mock.calls[0]?.[4]).toMatchObject({
			rkey: queued.ok ? queued.rkey : "",
		});
	});

	it("refuses a send that would push the queue past its byte cap", async () => {
		uploadBlob.mockImplementation(() => new Promise(() => undefined));

		const module = await load();
		const huge = new File(["x"], "huge.bin", {
			type: "application/octet-stream",
		});
		Object.defineProperty(huge, "size", { value: module.MAX_QUEUED_BYTES + 1 });

		const result = await enqueue(module, [huge]);

		expect(result).toEqual({ ok: false, reason: "tooLarge" });
		expect(module.pendingSends(SPACE)).toHaveLength(0);
	});
});

describe("discarding a send", () => {
	it("does not hand off a message discarded mid-upload", async () => {
		let release: (() => void) | undefined;
		uploadBlob.mockImplementation((_agent: unknown, target: File) =>
			new Promise<void>((resolve) => {
				release = resolve;
			}).then(() => blobRef(target.name)),
		);

		const module = await load();
		const queued = await enqueue(module, [file("a")]);
		await vi.advanceTimersByTimeAsync(0);

		if (queued.ok) module.discardSend(queued.rkey);
		release?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(enqueueSpaceCreate).not.toHaveBeenCalled();
		expect(module.pendingSends(SPACE)).toHaveLength(0);
	});

	it("tells listeners which row to drop", async () => {
		uploadBlob.mockImplementation(() => new Promise(() => undefined));

		const module = await load();
		const seen: string[] = [];
		module.onSendDiscarded((rkey) => seen.push(rkey));

		const queued = await enqueue(module, [file("a")]);
		await vi.advanceTimersByTimeAsync(0);
		if (queued.ok) module.discardSend(queued.rkey);

		expect(seen).toEqual([queued.ok ? queued.rkey : ""]);
	});
});
