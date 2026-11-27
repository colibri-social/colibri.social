import { colibri } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreferencesSpace } from "../preferences/remote";
import type { CommunityView } from "../types";
import { createFakeSession, json, xrpcError } from "./fake-session";
import {
	APPVIEW_COLLECTION,
	clearFederationCache,
	createFederation,
	DECLARE_CHECK_MS,
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

const memoryStorage = () => {
	const values = new Map<string, string>();

	return {
		values,
		read: (key: string) => values.get(key),
		write: (key: string, value: string) => {
			values.set(key, value);
		},
	};
};

const setup = (storage = memoryStorage()) => {
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
	fake.on("com.atproto.space.listRecords", json({ records: [] }));
	fake.on("com.atproto.repo.putRecord", json({ uri: "x", cid: "y" }));

	return {
		fake,
		storage,
		federation: createFederation({ transport, records, space, storage }),
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

describe("clearFederationCache", () => {
	it("removes only the federation keys", () => {
		const values = new Map([
			["colibri.federation.grant.v1:a:b", "x"],
			["colibri.federation.declared.v1:a:b", "y"],
			["colibri.nodes.v1", "z"],
		]);

		const storage = {
			get length() {
				return values.size;
			},
			key: (index: number) => [...values.keys()][index] ?? null,
			removeItem: (key: string) => {
				values.delete(key);
			},
		};

		clearFederationCache(storage);

		expect([...values.keys()]).toEqual(["colibri.nodes.v1"]);
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

	it("skips the declaration check for a day once it has passed", async () => {
		const storage = memoryStorage();
		const first = setup(storage);

		first.fake.on(
			"com.atproto.repo.getRecord",
			json({ uri: "x", value: { appviews: [OURS] } }),
		);
		await first.federation.declare();

		const second = setup(storage);

		await second.federation.declare();
		expect(second.fake.callsTo("com.atproto.repo.getRecord")).toEqual([]);

		vi.advanceTimersByTime(DECLARE_CHECK_MS);

		const third = setup(storage);

		third.fake.on(
			"com.atproto.repo.getRecord",
			json({ uri: "x", value: { appviews: [OURS] } }),
		);
		await third.federation.declare();
		expect(third.fake.callsTo("com.atproto.repo.getRecord")).toHaveLength(1);
	});

	it("waits for a remembered grant to near its expiry before granting again", async () => {
		const storage = memoryStorage();
		const first = setup(storage);
		const stopFirst = first.federation.start();

		first.federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		stopFirst();
		expect(first.fake.callsTo(GRANT)).toHaveLength(1);

		const second = setup(storage);
		const stopSecond = second.federation.start();

		const confirmed = [...storage.values].find(([key]) =>
			key.includes(".grant."),
		)?.[1];

		second.federation.reconcile([
			view(REMOTE, THEIRS, {
				isMember: true,
				preferencesAccessUntil: confirmed,
			} as CommunityView["viewer"]),
		]);
		await flush();
		expect(second.fake.callsTo(GRANT)).toEqual([]);
		expect(second.fake.callsTo(DELEGATE)).toEqual([]);

		await vi.advanceTimersByTimeAsync(420_000);
		expect(second.fake.callsTo(GRANT)).toHaveLength(1);

		stopSecond();
	});

	it("grants again once when a server reports no access despite a remembered grant", async () => {
		const storage = memoryStorage();
		const first = setup(storage);
		const stopFirst = first.federation.start();

		first.federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		stopFirst();

		const second = setup(storage);
		const stopSecond = second.federation.start();

		second.federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		expect(second.fake.callsTo(GRANT)).toHaveLength(1);

		second.federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		expect(second.fake.callsTo(GRANT)).toHaveLength(1);

		stopSecond();
	});

	it("keeps waiting when the server confirms its access", async () => {
		const storage = memoryStorage();
		const first = setup(storage);
		const stopFirst = first.federation.start();

		first.federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		stopFirst();

		const later = new Date(Date.now() + 3_600_000).toISOString();
		const second = setup(storage);
		const stopSecond = second.federation.start();

		second.federation.reconcile([
			view(REMOTE, THEIRS, {
				isMember: true,
				preferencesAccessUntil: later,
			} as CommunityView["viewer"]),
		]);
		await flush();
		expect(second.fake.callsTo(GRANT)).toEqual([]);
		expect([...storage.values.values()]).toContain(later);

		stopSecond();
	});

	it("doesn't grant twice when a server's view predates this session's grant", async () => {
		const { fake, federation } = setup();
		const stop = federation.start();

		federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();

		expect(fake.callsTo(GRANT)).toHaveLength(1);

		stop();
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

	it("records a Space this AppView manages as well", async () => {
		const { fake, federation } = setup();

		fake.on(GET_COMMUNITY, json({ community: view(LOCAL, OURS) }));
		await federation.joined(LOCAL);

		const [call] = fake.callsTo("com.atproto.space.putRecord");

		expect(call?.body).toMatchObject({
			rkey: LOCAL,
			record: { managingApp: OURS },
		});
		expect(fake.callsTo(GRANT)).toEqual([]);
	});

	it("records every joined Space that has no record yet, once", async () => {
		const { fake, federation } = setup();

		fake.on(
			"com.atproto.space.listRecords",
			json({
				records: [
					{
						collection: REMOTE_SPACE_COLLECTION,
						rkey: LOCAL,
						cid: "c",
						value: { managingApp: OURS },
					},
				],
			}),
		);

		federation.reconcile([view(LOCAL, OURS), view(REMOTE, THEIRS)]);
		await flush();
		federation.reconcile([view(LOCAL, OURS), view(REMOTE, THEIRS)]);
		await flush();

		const written = fake
			.callsTo("com.atproto.space.putRecord")
			.map((call) => (call.body as { rkey: string }).rkey);

		expect(written).toEqual([REMOTE]);
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

	it("stops granting an AppView once its Spaces leave the listing", async () => {
		const { fake, federation } = setup();
		const stop = federation.start();

		federation.reconcile([view(REMOTE, THEIRS)]);
		await flush();
		expect(fake.callsTo(GRANT)).toHaveLength(1);

		federation.reconcile([view(LOCAL, OURS)]);
		await vi.advanceTimersByTimeAsync(600_000);
		expect(fake.callsTo(GRANT)).toHaveLength(1);

		stop();
	});

	it("keeps granting a Space joined while the listing was in flight", async () => {
		const { fake, federation } = setup();
		const stop = federation.start();

		fake.on(GET_COMMUNITY, json({ community: view(REMOTE, THEIRS) }));

		const since = federation.mark();

		await federation.joined(REMOTE);
		await flush();
		expect(fake.callsTo(GRANT)).toHaveLength(1);

		federation.reconcile([view(LOCAL, OURS)], [], since);
		await vi.advanceTimersByTimeAsync(600_000);
		expect(fake.callsTo(GRANT).length).toBeGreaterThan(1);

		federation.reconcile([view(LOCAL, OURS)]);

		const granted = fake.callsTo(GRANT).length;

		await vi.advanceTimersByTimeAsync(600_000);
		expect(fake.callsTo(GRANT)).toHaveLength(granted);

		stop();
	});

	it("doesn't record a Space that was left while recording", async () => {
		const { fake, federation } = setup();

		federation.reconcile([view(REMOTE, THEIRS)]);
		await federation.forget(REMOTE);
		await flush();

		expect(fake.callsTo("com.atproto.space.putRecord")).toEqual([]);
		expect(fake.callsTo("com.atproto.space.deleteRecord")).toHaveLength(1);
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
