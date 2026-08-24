import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColibriError } from "../errors/error";
import { colibri } from "./lexicons";
import {
	RESUME_WINDOW_MS,
	readPending,
	writePending,
} from "./pending-community";
import { resumePendingCommunity } from "./resume-community-creation";
import type { CommunityView } from "./views";
import type { ColibriClient } from "./xrpc";

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
const DID = "did:plc:community";
const STARTED_AT = 10_000;

const communityView = (isMember: boolean, requiresApprovalToJoin = false) =>
	({
		did: DID,
		handle: "abcdef0123456789.colibri.social",
		name: "Birdwatchers",
		requiresApprovalToJoin,
		linkEmbeds: true,
		viewer: { isMember, isOwner: isMember },
	}) as unknown as CommunityView;

type Call = { nsid: string; input: Record<string, unknown> | undefined };

const stubClient = (
	responses: Record<string, () => unknown>,
): { client: ColibriClient; calls: Array<Call> } => {
	const calls: Array<Call> = [];
	const client = {
		call: (
			method: { nsid: string },
			input?: Record<string, unknown>,
		): Promise<unknown> => {
			calls.push({ nsid: method.nsid, input });
			const responder = responses[method.nsid];
			if (!responder) throw new Error(`unexpected call to ${method.nsid}`);
			return Promise.resolve(responder());
		},
	} as unknown as ColibriClient;
	return { client, calls };
};

const found =
	(isMember: boolean, requiresApprovalToJoin = false) =>
	() => ({
		ok: true,
		data: { community: communityView(isMember, requiresApprovalToJoin) },
	});

const notFound = () => ({
	ok: false,
	error: new ColibriError({ code: "CommunityNotFound" }),
});

const unreachable = () => ({
	ok: false,
	error: new ColibriError({ code: "UpstreamFailure" }),
});

const marker = {
	name: "Birdwatchers",
	requiresApprovalToJoin: false,
	startedAt: STARTED_AT,
	imagesDropped: false,
};

beforeEach(() => {
	vi.stubGlobal("localStorage", createLocalStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("resumePendingCommunity", () => {
	it("does nothing when no creation was interrupted", async () => {
		const { client, calls } = stubClient({});

		await expect(resumePendingCommunity(client, NS)).resolves.toEqual({
			kind: "none",
		});
		expect(calls).toHaveLength(0);
	});

	it("adopts the community the interrupted attempt already provisioned", async () => {
		writePending(NS, { ...marker, did: DID });
		const { client, calls } = stubClient({
			[colibri.community.getCommunity.main.nsid]: found(true),
		});

		const outcome = await resumePendingCommunity(
			client,
			NS,
			STARTED_AT + 1_000,
		);

		expect(outcome).toEqual({
			kind: "done",
			community: communityView(true),
			imagesDropped: false,
		});
		expect(calls.map((call) => call.nsid)).toEqual([
			colibri.community.getCommunity.main.nsid,
		]);
		expect(readPending(NS)).toBeUndefined();
	});

	it("reapplies the join setting the interrupted attempt never reached", async () => {
		writePending(NS, { ...marker, did: DID, requiresApprovalToJoin: true });
		const { client, calls } = stubClient({
			[colibri.community.getCommunity.main.nsid]: found(true),
			[colibri.community.update.main.nsid]: () => ({
				ok: true,
				data: { community: communityView(true, true) },
			}),
		});

		const outcome = await resumePendingCommunity(
			client,
			NS,
			STARTED_AT + 1_000,
		);

		expect(outcome).toEqual({
			kind: "done",
			community: communityView(true, true),
			imagesDropped: false,
		});
		expect(calls[1]).toEqual({
			nsid: colibri.community.update.main.nsid,
			input: { body: { community: DID, requiresApprovalToJoin: true } },
		});
	});

	it("keeps the community when the join setting cannot be reapplied", async () => {
		writePending(NS, { ...marker, did: DID, requiresApprovalToJoin: true });
		const { client } = stubClient({
			[colibri.community.getCommunity.main.nsid]: found(true),
			[colibri.community.update.main.nsid]: unreachable,
		});

		const outcome = await resumePendingCommunity(
			client,
			NS,
			STARTED_AT + 1_000,
		);

		expect(outcome).toEqual({
			kind: "done",
			community: communityView(true),
			imagesDropped: false,
		});
		expect(readPending(NS)).toBeUndefined();
	});

	it("holds the marker while the community has not indexed yet", async () => {
		writePending(NS, { ...marker, did: DID });
		const { client } = stubClient({
			[colibri.community.getCommunity.main.nsid]: notFound,
		});

		const outcome = await resumePendingCommunity(
			client,
			NS,
			STARTED_AT + 1_000,
		);

		expect(outcome).toEqual({ kind: "wait" });
		expect(readPending(NS)?.did).toBe(DID);
	});

	it("holds the marker while the AppView is still unreachable", async () => {
		writePending(NS, { ...marker, did: DID });
		const { client } = stubClient({
			[colibri.community.getCommunity.main.nsid]: unreachable,
		});

		await expect(
			resumePendingCommunity(client, NS, STARTED_AT + 1_000),
		).resolves.toEqual({ kind: "wait" });
		expect(readPending(NS)?.did).toBe(DID);
	});

	it("holds the marker when no progress event ever named the community", async () => {
		writePending(NS, marker);
		const { client, calls } = stubClient({});

		await expect(
			resumePendingCommunity(client, NS, STARTED_AT + 1_000),
		).resolves.toEqual({ kind: "wait" });
		expect(calls).toHaveLength(0);
		expect(readPending(NS)).toEqual(marker);
	});

	it("gives up on an orphan once the window closes", async () => {
		writePending(NS, { ...marker, did: DID });
		const { client } = stubClient({
			[colibri.community.getCommunity.main.nsid]: found(false),
		});

		const outcome = await resumePendingCommunity(
			client,
			NS,
			STARTED_AT + RESUME_WINDOW_MS,
		);

		expect(outcome).toEqual({ kind: "abandoned", name: "Birdwatchers" });
		expect(readPending(NS)).toBeUndefined();
	});

	it("gives up on a nameless attempt once the window closes", async () => {
		writePending(NS, marker);
		const { client } = stubClient({});

		await expect(
			resumePendingCommunity(client, NS, STARTED_AT + RESUME_WINDOW_MS),
		).resolves.toEqual({ kind: "abandoned", name: "Birdwatchers" });
		expect(readPending(NS)).toBeUndefined();
	});
});
