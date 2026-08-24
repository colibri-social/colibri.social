import type { Agent } from "@atproto/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColibriClient } from "./xrpc";

type QueueEntry = {
	uri: string;
	rkey: string;
	kind: "spacePut";
	space: string;
	collection: string;
	record: Record<string, unknown>;
	createdAt: number;
};

const { queue, enqueueSpacePut, queuedRecords } = vi.hoisted(() => {
	const queue: QueueEntry[] = [];
	return {
		queue,
		enqueueSpacePut: vi.fn(
			(
				space: string,
				repo: string,
				collection: string,
				rkey: string,
				record: Record<string, unknown>,
			) => {
				const existing = queue.find(
					(entry) =>
						entry.space === space &&
						entry.collection === collection &&
						entry.rkey === rkey,
				);
				if (existing) existing.record = record;
				else
					queue.push({
						uri: `${space}/${repo}/${collection}/${rkey}`,
						rkey,
						kind: "spacePut",
						space,
						collection,
						record,
						createdAt: 0,
					});
				return Promise.resolve({ uri: "at://x" });
			},
		),
		queuedRecords: vi.fn((collection: string) =>
			queue.filter((entry) => entry.collection === collection),
		),
	};
});

vi.mock("./outbox/outbox", () => ({ enqueueSpacePut, queuedRecords }));

const { writeCommunityOrder, writeNotificationLevel } = await import(
	"./notificationPreference"
);

const ACTOR = "did:plc:me";
const ORDER: Array<`did:${string}:${string}`> = [
	"did:plc:community-a",
	"did:plc:community-b",
];

describe("writeActorSettings", () => {
	let getRecord: ReturnType<typeof vi.fn>;
	let agent: Agent;
	let xrpc: ColibriClient;

	beforeEach(() => {
		queue.length = 0;
		enqueueSpacePut.mockClear();
		getRecord = vi.fn(() =>
			Promise.resolve({
				data: {
					value: {
						$type: "social.colibri.beta.actor.settings",
						notificationLevel: "all",
					},
				},
			}),
		);
		agent = {
			com: { atproto: { space: { getRecord } } },
		} as unknown as Agent;
		xrpc = {
			call: vi.fn(() => Promise.resolve({ ok: true, data: {} })),
		} as unknown as ColibriClient;
	});

	it("keeps a field written while the previous write is still queued", async () => {
		await writeNotificationLevel(agent, xrpc, ACTOR, "mentionsAndReplies");
		await writeCommunityOrder(agent, xrpc, ACTOR, ORDER);

		expect(queue).toHaveLength(1);
		expect(queue[0]?.record).toMatchObject({
			notificationLevel: "mentionsAndReplies",
			communityOrder: ORDER,
		});
	});

	it("does not re-read the stored record while one is queued", async () => {
		await writeNotificationLevel(agent, xrpc, ACTOR, "mentionsAndReplies");
		expect(getRecord).toHaveBeenCalledTimes(1);

		await writeCommunityOrder(agent, xrpc, ACTOR, ORDER);
		expect(getRecord).toHaveBeenCalledTimes(1);
	});

	it("pushes only the patch to the appview", async () => {
		await writeCommunityOrder(agent, xrpc, ACTOR, ORDER);

		expect(xrpc.call).toHaveBeenCalledWith(expect.anything(), {
			body: { communityOrder: ORDER },
		});
	});
});
