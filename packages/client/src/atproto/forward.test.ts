import { describe, expect, it } from "vitest";
import { isForwardable, planForward } from "./forward";
import {
	asCid,
	asDatetime,
	asDid,
	asRecordKey,
	asSpaceRef,
	asUri,
} from "./lexicons";
import type { AttachmentView, ForwardView, MessageView } from "./views";

const COMMUNITY = "did:plc:community000000000";
const AUTHOR = "did:plc:author0000000000000";
const RELAYER = "did:plc:relayer000000000000";
const CHANNEL = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/general`;
const OTHER = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/random`;
const SOURCE_CID =
	"bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiibsojllbf5xhqzy6a";

const attachment = (name: string): AttachmentView =>
	({
		url: asUri(`https://example.test/${name}`),
		mimeType: "image/png",
		name,
	}) as AttachmentView;

const profile = (did: string, handle: string): MessageView["author"] =>
	({ did: asDid(did), handle }) as unknown as MessageView["author"];

const message = (overrides: Partial<MessageView> = {}): MessageView =>
	({
		uri: `at://${AUTHOR}/social.colibri.beta.message/3lkforward0001`,
		channel: asSpaceRef(CHANNEL),
		rkey: asRecordKey("3lkforward0001"),
		author: profile(AUTHOR, "author.test"),
		text: "the original",
		createdAt: asDatetime("2026-09-01T10:00:00.000Z"),
		attachments: [],
		reactions: [],
		labels: [],
		...overrides,
	}) as unknown as MessageView;

describe("planForward", () => {
	it("snapshots a plain message and points at it", () => {
		const plan = planForward(
			message({ facets: [], attachments: [attachment("cat.png")] }),
		);

		expect(plan.snapshot.source).toEqual({
			space: CHANNEL,
			did: AUTHOR,
			rkey: "3lkforward0001",
		});
		expect(plan.snapshot.text).toBe("the original");
		expect(plan.snapshot.createdAt).toBe("2026-09-01T10:00:00.000Z");
		expect(plan.attachments).toHaveLength(1);
	});

	it("copies a forward's block verbatim instead of stacking a layer on it", () => {
		const carried = {
			source: {
				space: asSpaceRef(OTHER),
				did: asDid(AUTHOR),
				rkey: asRecordKey("3lkoriginal001"),
			},
			createdAt: asDatetime("2026-08-01T09:00:00.000Z"),
			text: "the very first message",
			attachments: [attachment("dog.png")],
		} as ForwardView;

		const relayed = message({
			uri: `at://${RELAYER}/social.colibri.beta.message/3lkrelay000001`,
			rkey: asRecordKey("3lkrelay000001"),
			author: profile(RELAYER, "relayer.test"),
			text: "look at this",
			createdAt: asDatetime("2026-09-02T11:00:00.000Z"),
			forward: carried,
		});

		const plan = planForward(relayed);

		expect(plan.snapshot.text).toBe("the very first message");
		expect(plan.snapshot.source).toEqual({
			space: OTHER,
			did: AUTHOR,
			rkey: "3lkoriginal001",
		});
		expect(plan.snapshot.createdAt).toBe("2026-08-01T09:00:00.000Z");
		expect(plan.attachments).toEqual(carried.attachments);
		expect("forward" in plan.snapshot).toBe(false);
	});

	it("keeps the copied pointer's cid when the block carries one", () => {
		const relayed = message({
			forward: {
				source: {
					space: asSpaceRef(OTHER),
					did: asDid(AUTHOR),
					rkey: asRecordKey("3lkoriginal001"),
					cid: asCid(SOURCE_CID),
				},
				createdAt: asDatetime("2026-08-01T09:00:00.000Z"),
				text: "the very first message",
				attachments: [],
			} as ForwardView,
		});

		expect(planForward(relayed).snapshot.source.cid).toBe(SOURCE_CID);
	});

	it("drops the pointer's cid when the block has none", () => {
		const relayed = message({
			forward: {
				source: {
					space: asSpaceRef(OTHER),
					did: asDid(AUTHOR),
					rkey: asRecordKey("3lkoriginal001"),
				},
				createdAt: asDatetime("2026-08-01T09:00:00.000Z"),
				text: "the very first message",
				attachments: [],
			} as ForwardView,
		});

		expect("cid" in planForward(relayed).snapshot.source).toBe(false);
	});

	it("carries no facets key when there are none", () => {
		expect(planForward(message()).snapshot.facets).toBeUndefined();
	});
});

describe("isForwardable", () => {
	it("accepts a message living in a space", () => {
		expect(isForwardable(message())).toBe(true);
	});

	it("rejects a message whose channel is not a space reference", () => {
		expect(
			isForwardable(
				message({ channel: "not-a-space" as MessageView["channel"] }),
			),
		).toBe(false);
	});
});
