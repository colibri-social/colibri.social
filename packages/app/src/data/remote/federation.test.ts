import { colibri } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreferencesSpace } from "../preferences/remote";
import type { CommunityView } from "../types";
import { createFakeSession, json, xrpcError } from "./fake-session";
import {
	APPVIEW_COLLECTION,
	createFederation,
	declaredWith,
	MAX_DECLARED_APPVIEWS,
	REMOTE_SPACE_COLLECTION,
} from "./federation";
import { createRecords } from "./records";
import { createTransport } from "./transport";

const VIEWER = "did:plc:viewer";
const OURS = "did:web:appview.test";
const THEIRS = "did:web:other.example";
const LOCAL = "did:plc:localspace";
const REMOTE = "did:plc:remotespace";
const GRANT = colibri.actor.grantSpaceAccess.main.nsid;
const GET_COMMUNITY = colibri.community.getCommunity.main.nsid;
const DELEGATE = "com.atproto.space.getDelegationToken";

const view = (
	did: string,
	managingApp: string,
	viewer: CommunityView["viewer"] = { isMember: true },
) => ({ did, managingApp, name: did, viewer }) as unknown as CommunityView;

const setup = () => {
	const fake = createFakeSession(VIEWER);

	const transport = createTransport({
		session: fake.session,
		appViewDid: OURS,
	});

	const space = createPreferencesSpace(transport);
	const records = createRecords(transport);

	fake.on(DELEGATE, json({ token: "delegation" }));
	fake.on(
		GRANT,
		json({ expiresAt: new Date(Date.now() + 600_000).toISOString() }),
	);
	fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "y" }));
	fake.on("com.atproto.space.deleteRecord", json({}));
	fake.on("com.atproto.repo.putRecord", json({ uri: "x", cid: "y" }));

	return {
		fake,
		federation: createFederation({ transport, records, space }),
	};
};

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("declaredWith", () => {
	it("appends this AppView once and keeps the newest entries", () => {
		expect(declaredWith(undefined, OURS)).toEqual([OURS]);
		expect(declaredWith([OURS, THEIRS], OURS)).toEqual([THEIRS, OURS]);

		const full = Array.from(
			{ length: MAX_DECLARED_APPVIEWS },
			(_, index) => `did:web:${index}.example`,
		);

		expect(declaredWith(full, OURS)).toEqual([...full.slice(1), OURS]);
	});
});

describe("createFederation", () => {
	it("declares this AppView when the record is missing", async () => {
		const { fake, federation } = setup();

		fake.on("com.atproto.repo.getRecord", xrpcError(400, "RecordNotFound"));
		await federation.declare();

		const [call] = fake.callsTo("com.atproto.repo.putRecord");

		expect(call?.body).toMatchObject({
			repo: VIEWER,
			collection: APPVIEW_COLLECTION,
			rkey: "self",
			record: { $type: APPVIEW_COLLECTION, appviews: [OURS] },
		});
	});

	it("leaves the record alone when it already lists this AppView", async () => {
		const { fake, federation } = setup();

		fake.on(
			"com.atproto.repo.getRecord",
			json({ uri: "x", value: { appviews: [THEIRS, OURS] } }),
		);
		await federation.declare();

		expect(fake.callsTo("com.atproto.repo.putRecord")).toEqual([]);
	});

	it("remembers a joined Space another AppView manages", async () => {
		const { fake, federation } = setup();

		fake.on(GET_COMMUNITY, json({ community: view(REMOTE, THEIRS) }));
		await federation.joined(REMOTE);

		const [call] = fake.callsTo("com.atproto.space.putRecord");

		expect(call?.body).toMatchObject({
			collection: REMOTE_SPACE_COLLECTION,
			rkey: REMOTE,
			record: { $type: REMOTE_SPACE_COLLECTION, managingApp: THEIRS },
		});
	});

	it("writes nothing for a Space this AppView manages", async () => {
		const { fake, federation } = setup();

		fake.on(GET_COMMUNITY, json({ community: view(LOCAL, OURS) }));
		await federation.joined(LOCAL);

		expect(fake.callsTo("com.atproto.space.putRecord")).toEqual([]);
	});

	it("grants each managing AppView once, naming one of its Spaces", async () => {
		const { fake, federation } = setup();
		const stop = federation.start();

		federation.reconcile([
			view(LOCAL, OURS),
			view(REMOTE, THEIRS),
			view("did:plc:another", THEIRS),
		]);
		await flush();

		const grants = fake.callsTo(GRANT);

		expect(grants).toHaveLength(1);
		expect(grants[0]?.body).toMatchObject({ community: REMOTE });

		stop();
	});

	it("drops a remote Space the user no longer belongs to and deletes its record", async () => {
		const { fake, federation } = setup();

		const kept = federation.reconcile([
			view(LOCAL, OURS),
			view(REMOTE, THEIRS, { isMember: false }),
		]);
		await flush();

		expect(kept.map((entry) => entry.did)).toEqual([LOCAL]);
		expect(
			fake.callsTo("com.atproto.space.deleteRecord")[0]?.body,
		).toMatchObject({
			collection: REMOTE_SPACE_COLLECTION,
			rkey: REMOTE,
		});
	});

	it("keeps granting a Space whose AppView is unreachable, and forgets it on leave", async () => {
		const { fake, federation } = setup();
		const stop = federation.start();

		federation.reconcile([], [{ did: REMOTE, managingApp: THEIRS }]);
		await flush();
		expect(fake.callsTo(GRANT)).toHaveLength(1);

		await federation.forget(REMOTE);
		expect(fake.callsTo("com.atproto.space.deleteRecord")).toHaveLength(1);

		await federation.forget(LOCAL);
		expect(fake.callsTo("com.atproto.space.deleteRecord")).toHaveLength(1);

		stop();
	});
});
