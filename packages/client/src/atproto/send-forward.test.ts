import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ForwardPlan } from "./forward";
import { asDatetime, asDid, asRecordKey, asSpaceRef, asUri } from "./lexicons";
import type { AttachmentView } from "./views";

const COMMUNITY = "did:plc:community000000000";
const AUTHOR = "did:plc:author0000000000000";
const SOURCE = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/general`;
const ONE = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/one`;
const TWO = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/two`;

const enqueueSpaceCreate = vi.fn();
const enqueueMessageSend = vi.fn();

vi.mock("./outbox/outbox", () => ({
	enqueueSpaceCreate: (...args: unknown[]) => enqueueSpaceCreate(...args),
}));

vi.mock("./outbox/sends", () => ({
	enqueueMessageSend: (...args: unknown[]) => enqueueMessageSend(...args),
}));

const plan = (attachments: AttachmentView[] = []): ForwardPlan => ({
	snapshot: {
		source: {
			space: asSpaceRef(SOURCE),
			did: asDid(AUTHOR),
			rkey: asRecordKey("3lkoriginal001"),
		},
		createdAt: asDatetime("2026-09-01T10:00:00.000Z"),
		text: "the original",
	},
	attachments,
});

const attachment = (name: string): AttachmentView =>
	({
		url: asUri(`https://example.test/${name}`),
		mimeType: "image/png",
		name,
	}) as AttachmentView;

const load = async () => await import("./forward");

beforeEach(() => {
	vi.resetModules();
	enqueueSpaceCreate.mockReset();
	enqueueSpaceCreate.mockResolvedValue({ uri: "at://sent", rkey: "r" });
	enqueueMessageSend.mockReset();
	enqueueMessageSend.mockResolvedValue({ ok: true, rkey: "r" });
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, blob: async () => new Blob(["x"]) })),
	);
});

describe("sendForward", () => {
	it("writes one record per destination", async () => {
		const { sendForward } = await load();

		const result = await sendForward({
			plan: plan(),
			spaces: [ONE, TWO],
			repo: AUTHOR,
			comment: "look at this",
		});

		expect(result).toEqual({ ok: true, sent: 2 });
		expect(enqueueSpaceCreate).toHaveBeenCalledTimes(2);
		expect(enqueueSpaceCreate.mock.calls.map((call) => call[0])).toEqual([
			ONE,
			TWO,
		]);
		const record = enqueueSpaceCreate.mock.calls[0]?.[3] as {
			text: string;
			forward: { text: string };
		};
		expect(record.text).toBe("look at this");
		expect(record.forward.text).toBe("the original");
	});

	it("downloads the attachments once and reuses them for every destination", async () => {
		const { sendForward } = await load();

		await sendForward({
			plan: plan([attachment("cat.png")]),
			spaces: [ONE, TWO],
			repo: AUTHOR,
			comment: "",
		});

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(enqueueMessageSend).toHaveBeenCalledTimes(2);
		expect(enqueueSpaceCreate).not.toHaveBeenCalled();
	});

	it("sends nothing when the attachments cannot be copied", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404 })),
		);
		const { sendForward } = await load();

		const result = await sendForward({
			plan: plan([attachment("cat.png")]),
			spaces: [ONE, TWO],
			repo: AUTHOR,
			comment: "",
		});

		expect(result).toEqual({ ok: false, reason: "download" });
		expect(enqueueMessageSend).not.toHaveBeenCalled();
	});

	it("reports how many destinations took the forward", async () => {
		enqueueSpaceCreate.mockImplementation((space: string) =>
			space === TWO
				? Promise.reject(new Error("nope"))
				: Promise.resolve({ uri: "at://sent", rkey: "r" }),
		);
		const { sendForward } = await load();

		const result = await sendForward({
			plan: plan(),
			spaces: [ONE, TWO],
			repo: AUTHOR,
			comment: "",
		});

		expect(result).toEqual({ ok: false, reason: "partial", sent: 1, total: 2 });
	});
});
