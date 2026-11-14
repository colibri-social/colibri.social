import { colibri } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import { createPreferencesSpace } from "../preferences/remote";
import {
	createFakeSession,
	json,
	type RecordedCall,
	xrpcError,
} from "../remote/fake-session";
import { createTransport } from "../remote/transport";
import type { HostMode } from "./host-mode";
import { createHostMode, type HostStatus } from "./host-mode";
import type { MigrationRecord } from "./migrator";
import { createMigrator } from "./migrator";

const VIEWER = "did:plc:viewer";
const CHANNEL = "at://did:plc:space/space/social.colibri.beta.channel/general";
const PREFERENCES = `at://${VIEWER}/space/social.colibri.beta.actor.preferences/self`;
const MESSAGE = "social.colibri.beta.message";
const SETTINGS = "social.colibri.beta.actor.settings";
const APPLY = "com.atproto.space.applyWrites";
const LIST = "com.atproto.space.listRecords";
const UPLOAD = "com.atproto.repo.uploadBlob";
const CREATE_SPACE = "com.atproto.space.createSpace";

type Write = {
	$type: string;
	collection: string;
	rkey: string;
	value?: unknown;
};

const cidOf = (value: unknown) => `cid:${JSON.stringify(value)}`;

const record = (
	collection: string,
	rkey: string,
	value: Record<string, unknown>,
): MigrationRecord => {
	const full = { $type: collection, ...value };

	return {
		collection: collection as MigrationRecord["collection"],
		rkey,
		cid: cidOf(full),
		value: full,
	};
};

const messages = (count: number) =>
	Array.from({ length: count }, (_, index) =>
		record(MESSAGE, `m${String(index).padStart(4, "0")}`, {
			text: `message ${index}`,
		}),
	);

const createWorld = (hosted: Record<string, MigrationRecord[]>) => {
	const fake = createFakeSession(VIEWER);
	const pds = new Map<string, Map<string, string>>();
	const verified = new Set<string>();
	const applied: Array<{ space: string; writes: Write[] }> = [];
	const granted: number[] = [];
	let mode: HostMode = "polyfill";
	let failApplyAt: number | undefined;
	let onApply: ((call: number) => void) | undefined;
	let completions = 0;

	const repoOf = (space: string) => {
		let repo = pds.get(space);

		if (!repo) {
			repo = new Map();
			pds.set(space, repo);
		}

		return repo;
	};

	const pending = () =>
		Object.keys(hosted).filter((space) => !verified.has(space));

	const matches = (space: string) => {
		const repo = repoOf(space);
		const expected = hosted[space] ?? [];

		return (
			repo.size === expected.length &&
			expected.every(
				(entry) => repo.get(`${entry.collection}/${entry.rkey}`) === entry.cid,
			)
		);
	};

	fake.on(colibri.polyfill.getStatus.main.nsid, () =>
		json({ mode, pdsSupportsSpaces: true }),
	);
	fake.on(colibri.polyfill.beginMigration.main.nsid, () => {
		if (pending().length > 0) mode = "migrating";

		return json({ spaces: pending() });
	});
	fake.on(colibri.polyfill.listForMigration.main.nsid, (call: RecordedCall) => {
		const space = call.params.get("space") ?? "";
		const limit = Number(call.params.get("limit"));
		const from = Number(call.params.get("cursor") ?? 0);
		const all = hosted[space] ?? [];
		const page = all.slice(from, from + limit);
		const next = from + limit < all.length ? String(from + limit) : undefined;

		return json({ records: page, ...(next ? { cursor: next } : {}) });
	});
	fake.on(LIST, (call: RecordedCall) => {
		const space = call.params.get("space") ?? "";

		if (!pds.has(space)) return xrpcError(400, "RepoNotFound");

		const records = [...repoOf(space)].map(([key, cid]) => {
			const [collection, rkey] = key.split("/");

			return { collection, rkey, cid };
		});

		return json({ records });
	});
	fake.on(APPLY, (call: RecordedCall) => {
		const body = call.body as { space: string; writes: Write[] };
		const index = applied.length;

		if (failApplyAt === index) {
			failApplyAt = undefined;
			return xrpcError(400, "InvalidRequest");
		}

		applied.push(body);
		onApply?.(index);

		const repo = repoOf(body.space);

		for (const write of body.writes) {
			const key = `${write.collection}/${write.rkey}`;

			if (write.$type.endsWith("#delete")) repo.delete(key);
			else repo.set(key, cidOf(write.value));
		}

		return json({ results: [] });
	});
	fake.on(
		colibri.polyfill.completeMigration.main.nsid,
		(call: RecordedCall) => {
			const { space } = call.body as { space: string };

			completions += 1;

			if (!matches(space)) {
				mode = "polyfill";
				return json({ mode, missing: [`${space}/missing`] });
			}

			verified.add(space);

			if (pending().length === 0) mode = "native";

			return json({ mode });
		},
	);
	fake.on(
		colibri.polyfill.getBlob.main.nsid,
		() => new Response(new Uint8Array([1, 2, 3])),
	);
	fake.on(UPLOAD, json({ blob: {} }));
	fake.on(CREATE_SPACE, json({}));

	return {
		fake,
		pds,
		granted,
		applied,
		verified,
		repoOf,
		completions: () => completions,
		failApplyAt: (index: number) => {
			failApplyAt = index;
		},
		onApply: (listener: (call: number) => void) => {
			onApply = listener;
		},
	};
};

const startMigrator = (
	world: ReturnType<typeof createWorld>,
	grantPreferences: () => Promise<boolean> = async () => {
		world.granted.push(world.verified.size);

		return true;
	},
) => {
	const transport = createTransport({
		session: world.fake.session,
		appViewDid: "did:web:appview.test",
	});
	const host = createHostMode({ transport });
	const wait = vi.fn(async (_ms: number) => {});
	const migrator = createMigrator({
		transport,
		host,
		preferencesSpace: createPreferencesSpace(transport, host),
		grantPreferences,
		wait,
	});
	const seen: HostStatus[] = [];

	host.subscribe((status) => seen.push(status));

	const stop = migrator.start();

	void host.refresh();

	return { host, wait, seen, stop };
};

const settled = async (host: ReturnType<typeof createHostMode>) => {
	await vi.waitFor(() => expect(host.mode()).toBe("native"));
};

describe("polyfill migrator", () => {
	it("copies every hosted record to the provider and switches to native", async () => {
		const attachment = {
			$type: "blob",
			ref: { $link: "bafy-attachment" },
			mimeType: "image/png",
			size: 3,
		};
		const channel = [
			...messages(119),
			record(MESSAGE, "with-file", {
				text: "look",
				attachments: [{ blob: attachment }],
			}),
		];
		const world = createWorld({
			[CHANNEL]: channel,
			[PREFERENCES]: [record(SETTINGS, "self", { theme: "dark" })],
		});
		const { host, seen } = startMigrator(world);

		await settled(host);

		const channelWrites = world.applied.filter(
			(batch) => batch.space === CHANNEL,
		);

		expect(channelWrites.map((batch) => batch.writes.length)).toEqual([
			50, 50, 20,
		]);
		expect(channelWrites.flatMap((batch) => batch.writes)).toEqual(
			channel.map((entry) => ({
				$type: "com.atproto.space.applyWrites#create",
				collection: entry.collection,
				rkey: entry.rkey,
				value: entry.value,
			})),
		);
		expect(world.fake.callsTo(CREATE_SPACE)).toHaveLength(1);
		expect(
			world.fake
				.callsTo(colibri.polyfill.getBlob.main.nsid)[0]
				?.params.get("cid"),
		).toBe("bafy-attachment");

		const [upload] = world.fake.callsTo(UPLOAD);

		expect(upload?.headers.get("content-type")).toBe("image/png");
		expect(upload?.headers.get("atproto-proxy")).toBeNull();
		expect(world.verified).toEqual(new Set([CHANNEL, PREFERENCES]));
		expect(
			seen
				.filter((status) => status.mode === "migrating")
				.map((status) => status.migration),
		).toContainEqual({ spacesTotal: 2, spacesDone: 1 });
	});

	it("grants access to the copied preferences before asking for verification", async () => {
		const world = createWorld({
			[PREFERENCES]: [record(SETTINGS, "self", { theme: "dark" })],
		});
		const { host } = startMigrator(world);

		await settled(host);

		expect(world.granted).toEqual([0]);
		expect(world.verified).toEqual(new Set([PREFERENCES]));
	});

	it("doesn't verify preferences it couldn't grant access to", async () => {
		const world = createWorld({
			[PREFERENCES]: [record(SETTINGS, "self", { theme: "dark" })],
		});
		const { host, wait } = startMigrator(world, async () => false);

		await vi.waitFor(() => expect(wait).toHaveBeenCalled());

		expect(world.verified.size).toBe(0);
		expect(host.mode()).not.toBe("native");
	});

	it("doesn't start while the provider can't hold spaces", async () => {
		const world = createWorld({ [CHANNEL]: messages(2) });

		world.fake.on(colibri.polyfill.getStatus.main.nsid, () =>
			json({ mode: "polyfill", pdsSupportsSpaces: false }),
		);

		const { host } = startMigrator(world);

		await host.resolved();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(
			world.fake.callsTo(colibri.polyfill.beginMigration.main.nsid),
		).toHaveLength(0);
	});

	it("resumes after an interruption without writing records twice", async () => {
		const channel = messages(80);
		const world = createWorld({ [CHANNEL]: channel });

		world.failApplyAt(1);

		const { host, wait } = startMigrator(world);

		await settled(host);

		const written = world.applied.flatMap((batch) =>
			batch.writes.map((write) => write.rkey),
		);

		expect(wait).toHaveBeenCalledOnce();
		expect(written).toHaveLength(80);
		expect(new Set(written).size).toBe(80);
	});

	it("picks up where a closed app left off", async () => {
		const channel = messages(60);
		const world = createWorld({
			[CHANNEL]: channel,
			[PREFERENCES]: [record(SETTINGS, "self", { theme: "dark" })],
		});
		const repo = world.repoOf(CHANNEL);

		for (const entry of channel.slice(0, 50))
			repo.set(`${entry.collection}/${entry.rkey}`, entry.cid);

		world.verified.add(PREFERENCES);

		const { host } = startMigrator(world);

		await settled(host);

		expect(world.applied).toHaveLength(1);
		expect(world.applied[0]?.writes.map((write) => write.rkey)).toEqual(
			channel.slice(50).map((entry) => entry.rkey),
		);
		expect(world.fake.callsTo(CREATE_SPACE)).toHaveLength(0);
	});

	it("replays the difference once when verification finds a mismatch", async () => {
		const hosted = { [CHANNEL]: messages(3) };
		const world = createWorld(hosted);
		const late = record(MESSAGE, "late", { text: "sent while moving" });

		world.onApply((call) => {
			if (call === 0) hosted[CHANNEL].push(late);
		});

		const { host } = startMigrator(world);

		await settled(host);

		expect(world.completions()).toBe(2);
		expect(
			world.fake.callsTo(colibri.polyfill.beginMigration.main.nsid),
		).toHaveLength(2);
		expect(world.applied[1]?.writes).toEqual([
			{
				$type: "com.atproto.space.applyWrites#create",
				collection: MESSAGE,
				rkey: "late",
				value: late.value,
			},
		]);
	});

	it("removes provider records the AppView no longer holds", async () => {
		const channel = messages(2);
		const world = createWorld({ [CHANNEL]: channel });

		world.repoOf(CHANNEL).set(`${MESSAGE}/gone`, "cid:old");

		const { host } = startMigrator(world);

		await settled(host);

		expect(world.applied[0]?.writes).toContainEqual({
			$type: "com.atproto.space.applyWrites#delete",
			collection: MESSAGE,
			rkey: "gone",
		});
	});

	it("runs once per session", async () => {
		const world = createWorld({ [CHANNEL]: messages(1) });
		const { host } = startMigrator(world);

		await settled(host);

		host.apply({ mode: "polyfill", pdsSupportsSpaces: true });
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(
			world.fake.callsTo(colibri.polyfill.beginMigration.main.nsid),
		).toHaveLength(1);
	});
});
