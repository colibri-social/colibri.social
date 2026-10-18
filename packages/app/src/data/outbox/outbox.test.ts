import { ColibriError, createMemoryKvStore } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentView, MessageView, SpaceRef } from "../types";
import {
	createOutbox,
	OUTBOX_BLOB_REF_TTL_MS,
	OUTBOX_MAX_QUEUED_BYTES,
	type OutboxOptions,
} from "./outbox";
import { createOutboxQueue } from "./queue";
import type { OutboxEvent, OutboxOp } from "./types";

const CHANNEL = "at://did:plc:space/space/general" as SpaceRef;

const viewOf = (rkey: string, text = "hi") =>
	({ rkey, channel: CHANNEL, text }) as unknown as MessageView;

const fakeSource = () => {
	const calls: string[] = [];
	const failures: ColibriError[] = [];
	const nextFailure = () => {
		const failure = failures.shift();
		if (failure) throw failure;
	};
	const source: OutboxOptions["source"] = {
		sendMessage: vi.fn(async (input) => {
			calls.push(`send:${input.rkey}:${input.text}`);
			nextFailure();
			return viewOf(input.rkey ?? "", input.text);
		}),
		editMessage: vi.fn(async (input) => {
			calls.push(`edit:${input.rkey}:${input.text}`);
			nextFailure();
			return viewOf(input.rkey, input.text);
		}),
		deleteMessage: vi.fn(async (input) => {
			calls.push(`delete:${input.rkey}`);
			nextFailure();
		}),
		react: vi.fn(async (input) => {
			calls.push(`react:${input.rkey}:${input.emoji}:${input.add}`);
			nextFailure();
		}),
		forwardMessage: vi.fn(async (input) => {
			calls.push(`forward:${input.forwardRkey}`);
			nextFailure();
			return viewOf(input.forwardRkey ?? "");
		}),
		deleteThread: vi.fn(async (input) => {
			calls.push(`deleteThread:${input.thread}`);
			nextFailure();
		}),
		uploadBlob: vi.fn(async (file: File) => {
			calls.push(`upload:${file.name}`);
			nextFailure();
			return {
				url: `blob:${file.name}`,
				name: file.name,
				mimeType: file.type,
				size: file.size,
			} as AttachmentView;
		}),
	};
	return { source, calls, failures };
};

const send = (rkey: string, text = "hi", files: File[] = []): OutboxOp => ({
	t: "send",
	channel: CHANNEL,
	rkey,
	text,
	files: files.map((file) => ({ file })),
});

const settle = async () => {
	for (let round = 0; round < 10; round++) await vi.advanceTimersByTimeAsync(0);
};

describe("outbox", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const make = (overrides: Partial<OutboxOptions> = {}) => {
		const fake = fakeSource();
		const outbox = createOutbox({
			source: fake.source,
			random: () => 0.5,
			watch: false,
			...overrides,
		});
		const events: OutboxEvent[] = [];
		outbox.subscribe((event) => events.push(event));
		return { ...fake, outbox, events };
	};

	it("runs writes in the order they were queued", async () => {
		const { outbox, calls, events } = make();
		outbox.enqueue(send("a", "first"));
		outbox.enqueue({ t: "edit", channel: CHANNEL, rkey: "z", text: "x" });
		outbox.enqueue(send("b", "second"));
		await settle();
		expect(calls).toEqual(["send:a:first", "edit:z:x", "send:b:second"]);
		expect(events.filter((event) => event.type === "sent")).toHaveLength(3);
		expect(outbox.pendingCount()).toBe(0);
	});

	it("retries a retryable failure after a backoff", async () => {
		const { outbox, calls, failures } = make();
		failures.push(new ColibriError({ code: "PdsUnavailable" }));
		const ticket = outbox.enqueue(send("a"));
		await settle();
		expect(calls).toEqual(["send:a:hi"]);
		expect(outbox.pendingCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(2_000);
		await settle();
		expect(calls).toEqual(["send:a:hi", "send:a:hi"]);
		await expect(ticket.settled).resolves.toMatchObject({
			message: { rkey: "a" },
		});
	});

	it("keeps a send that failed for good until it is retried", async () => {
		const { outbox, calls, failures, events } = make();
		failures.push(new ColibriError({ code: "InvalidRequest" }));
		outbox.enqueue(send("a"));
		outbox.enqueue(send("b"));
		await settle();
		expect(calls).toEqual(["send:a:hi", "send:b:hi"]);
		expect(events.find((event) => event.type === "failed")).toMatchObject({
			code: "InvalidRequest",
		});
		const [parked] = outbox.entries();
		expect(parked?.failed).toBe(true);
		expect(outbox.pendingCount()).toBe(0);
		outbox.retry(parked?.seq ?? 0);
		await settle();
		expect(calls.at(-1)).toBe("send:a:hi");
		expect(outbox.entries()).toHaveLength(0);
	});

	it("drops other writes that failed for good and rejects their ticket", async () => {
		const { outbox, failures } = make();
		failures.push(new ColibriError({ code: "Forbidden" }));
		const ticket = outbox.enqueue({
			t: "edit",
			channel: CHANNEL,
			rkey: "a",
			text: "x",
		});
		await settle();
		await expect(ticket.settled).rejects.toMatchObject({ code: "Forbidden" });
		expect(outbox.entries()).toHaveLength(0);
	});

	it("waits while offline without spending attempts", async () => {
		let online = false;
		const { outbox, calls } = make({ online: () => online });
		outbox.enqueue(send("a"));
		await settle();
		expect(calls).toEqual([]);
		online = true;
		outbox.flush();
		await settle();
		expect(calls).toEqual(["send:a:hi"]);
	});

	it("holds writes while the session needs signing in again", async () => {
		let dead = true;
		const { outbox, calls } = make({ held: () => dead });
		outbox.enqueue(send("a"));
		await settle();
		expect(calls).toEqual([]);
		dead = false;
		outbox.flush();
		await settle();
		expect(calls).toEqual(["send:a:hi"]);
	});

	it("treats a delete of something already gone as done", async () => {
		const { outbox, failures, events } = make();
		failures.push(new ColibriError({ code: "NotFound" }));
		const ticket = outbox.enqueue({ t: "delete", channel: CHANNEL, rkey: "a" });
		await settle();
		await expect(ticket.settled).resolves.toEqual({});
		expect(events.some((event) => event.type === "failed")).toBe(false);
	});

	it("treats a create that already exists as done", async () => {
		const { outbox, failures } = make();
		failures.push(new ColibriError({ code: "AlreadyExists" }));
		const ticket = outbox.enqueue(send("a"));
		await settle();
		await expect(ticket.settled).resolves.toEqual({});
		expect(outbox.entries()).toHaveLength(0);
	});

	describe("coalescing", () => {
		it("drops a queued send and its edits when the message is deleted", async () => {
			let online = false;
			const { outbox, calls, events } = make({ online: () => online });
			outbox.enqueue(send("a"));
			outbox.enqueue({ t: "edit", channel: CHANNEL, rkey: "a", text: "x" });
			outbox.enqueue({ t: "delete", channel: CHANNEL, rkey: "a" });
			expect(outbox.entries()).toHaveLength(0);
			expect(events.filter((event) => event.type === "dropped")).toHaveLength(
				1,
			);
			online = true;
			outbox.flush();
			await settle();
			expect(calls).toEqual([]);
		});

		it("folds an edit into a queued send", async () => {
			let online = false;
			const { outbox, calls } = make({ online: () => online });
			outbox.enqueue(send("a", "draft"));
			outbox.enqueue({ t: "edit", channel: CHANNEL, rkey: "a", text: "final" });
			online = true;
			outbox.flush();
			await settle();
			expect(calls).toEqual(["send:a:final"]);
		});

		it("keeps only the latest queued edit", async () => {
			let online = false;
			const { outbox, calls } = make({ online: () => online });
			outbox.enqueue({ t: "edit", channel: CHANNEL, rkey: "a", text: "one" });
			outbox.enqueue({ t: "edit", channel: CHANNEL, rkey: "a", text: "two" });
			online = true;
			outbox.flush();
			await settle();
			expect(calls).toEqual(["edit:a:two"]);
		});

		it("cancels a reaction that is removed before it was sent", async () => {
			let online = false;
			const { outbox, calls } = make({ online: () => online });
			const reaction = {
				t: "react" as const,
				channel: CHANNEL,
				rkey: "a",
				emoji: "🐦",
				author: "did:plc:author" as never,
				reaction: "r1",
			};
			outbox.enqueue({ ...reaction, add: true });
			outbox.enqueue({ ...reaction, add: false });
			online = true;
			outbox.flush();
			await settle();
			expect(calls).toEqual([]);
		});
	});

	it("uploads files before sending and reports progress", async () => {
		const { outbox, calls, events } = make();
		const file = new File(["x"], "cat.png", { type: "image/png" });
		outbox.enqueue(send("a", "look", [file]));
		await settle();
		expect(calls).toEqual(["upload:cat.png", "send:a:look"]);
		expect(
			events.some((event) => event.type === "progress" && event.fraction === 1),
		).toBe(true);
	});

	it("uploads only the file that failed on the next try", async () => {
		const { outbox, calls, failures } = make();
		const files = [
			new File(["1"], "one.png", { type: "image/png" }),
			new File(["2"], "two.png", { type: "image/png" }),
		];
		failures.push(new ColibriError({ code: "UploadFailed" }));
		outbox.enqueue(send("a", "pair", files));
		await settle();
		await vi.advanceTimersByTimeAsync(2_000);
		await settle();
		expect(calls).toEqual([
			"upload:one.png",
			"upload:two.png",
			"upload:one.png",
			"send:a:pair",
		]);
	});

	it("uploads every file again when a failed send is retried by hand", async () => {
		const { outbox, calls, source } = make();
		const files = [
			new File(["1"], "one.png", { type: "image/png" }),
			new File(["2"], "two.png", { type: "image/png" }),
		];
		vi.mocked(source.sendMessage).mockRejectedValueOnce(
			new ColibriError({ code: "InvalidRequest" }),
		);
		outbox.enqueue(send("a", "pair", files));
		await settle();
		const [parked] = outbox.entries();
		expect(parked?.failed).toBe(true);
		calls.length = 0;
		outbox.retry(parked?.seq ?? 0);
		await settle();
		expect(calls).toEqual(["upload:one.png", "upload:two.png", "send:a:pair"]);
	});

	it("uploads a file again once its blob ref is older than ten minutes", async () => {
		let clock = 1_000_000;
		const { outbox, calls, failures } = make({ now: () => clock });
		const files = [
			new File(["1"], "one.png", { type: "image/png" }),
			new File(["2"], "two.png", { type: "image/png" }),
		];
		failures.push(new ColibriError({ code: "UploadFailed" }));
		outbox.enqueue(send("a", "pair", files));
		await settle();
		clock += OUTBOX_BLOB_REF_TTL_MS + 1;
		await vi.advanceTimersByTimeAsync(2_000);
		await settle();
		expect(calls).toEqual([
			"upload:one.png",
			"upload:two.png",
			"upload:one.png",
			"upload:two.png",
			"send:a:pair",
		]);
	});

	it("refuses files past the queue limit", async () => {
		const { outbox, events } = make({ online: () => false });
		const huge = new File(["x"], "huge.bin");
		Object.defineProperty(huge, "size", { value: OUTBOX_MAX_QUEUED_BYTES + 1 });
		const ticket = outbox.enqueue(send("a", "", [huge]));
		await settle();
		await expect(ticket.settled).rejects.toMatchObject({
			code: "FileTooLarge",
		});
		expect(events.find((event) => event.type === "failed")).toMatchObject({
			code: "FileTooLarge",
		});
	});

	describe("persistence", () => {
		it("replays queued writes after a restart, uploading files again", async () => {
			const kv = createMemoryKvStore();
			const first = make({
				online: () => false,
				queue: createOutboxQueue({ owner: "app:did:plc:me", kv }),
			});
			first.outbox.enqueue(
				send("a", "later", [new File(["1"], "one.png", { type: "image/png" })]),
			);
			first.outbox.enqueue({ t: "delete", channel: CHANNEL, rkey: "old" });
			await settle();
			first.outbox.dispose();

			const second = make({
				queue: createOutboxQueue({ owner: "app:did:plc:me", kv }),
			});
			await settle();
			expect(second.calls).toEqual([
				expect.stringMatching(/^upload:/),
				"send:a:later",
				"delete:old",
			]);
			expect([...(kv.data.get("entries")?.keys() ?? [])]).toEqual([]);
		});

		it("only loads the signed-in account's writes", async () => {
			const kv = createMemoryKvStore();
			const first = make({
				online: () => false,
				queue: createOutboxQueue({ owner: "app:did:plc:me", kv }),
			});
			first.outbox.enqueue(send("a"));
			await settle();
			const other = make({
				queue: createOutboxQueue({ owner: "app:did:plc:other", kv }),
			});
			await settle();
			expect(other.calls).toEqual([]);
			expect(other.outbox.entries()).toHaveLength(0);
		});
	});

	describe("drain", () => {
		it("resolves once every write landed", async () => {
			const { outbox } = make();
			outbox.enqueue(send("a"));
			const drained = outbox.drain(4_000);
			await settle();
			await expect(drained).resolves.toBe(true);
		});

		it("gives up at the deadline", async () => {
			const { outbox } = make({ online: () => false });
			outbox.enqueue(send("a"));
			const drained = outbox.drain(4_000);
			await vi.advanceTimersByTimeAsync(4_000);
			await expect(drained).resolves.toBe(false);
		});

		it("ignores sends parked as failed", async () => {
			const { outbox, failures } = make();
			failures.push(new ColibriError({ code: "InvalidRequest" }));
			outbox.enqueue(send("a"));
			await settle();
			await expect(outbox.drain(1_000)).resolves.toBe(true);
		});
	});
});
