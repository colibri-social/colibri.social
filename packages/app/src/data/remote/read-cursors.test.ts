import type { SnapshotClock } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import {
	type ChannelCursor,
	createReadCursorWriter,
	READ_CURSOR_DEBOUNCE_MS,
} from "./read-cursors";

const fakeClock = () => {
	let now = 100_000;
	const timers = new Map<number, { at: number; run: () => void }>();
	let next = 0;
	const clock: SnapshotClock<number> = {
		now: () => now,
		setTimer: (run, ms) => {
			next += 1;
			timers.set(next, { at: now + ms, run });
			return next;
		},
		clearTimer: (handle) => {
			timers.delete(handle);
		},
	};
	const advance = (ms: number) => {
		now += ms;
		for (const [handle, timer] of [...timers]) {
			if (timer.at <= now) {
				timers.delete(handle);
				timer.run();
			}
		}
	};
	return { clock, advance };
};

const setup = (existing: ChannelCursor[] = []) => {
	const pushes: ChannelCursor[][] = [];
	const persisted: ChannelCursor[][] = [];
	let hydrations = 0;
	const { clock, advance } = fakeClock();
	const writer = createReadCursorWriter(
		{
			hydrate: async () => {
				hydrations += 1;
				return existing;
			},
			persist: async (_community, cursors) => {
				persisted.push(cursors);
			},
			push: async (_community, cursors) => {
				pushes.push(cursors);
			},
		},
		{ clock },
	);
	return { writer, pushes, persisted, advance, hydrations: () => hydrations };
};

const sorted = (cursors: ChannelCursor[] | undefined) =>
	[...(cursors ?? [])].sort((a, b) => a.channel.localeCompare(b.channel));

describe("read cursor writer", () => {
	it("always sends every channel of the Space, not only the one just read", async () => {
		const { writer, pushes, persisted } = setup([
			{ channel: "dev", cursor: "3aaa" },
		]);
		writer.record("did:plc:space", "general", "3bbb");
		await writer.flush();
		expect(sorted(pushes.at(-1))).toEqual([
			{ channel: "dev", cursor: "3aaa" },
			{ channel: "general", cursor: "3bbb" },
		]);
		expect(sorted(persisted.at(-1))).toEqual(sorted(pushes.at(-1)));
	});

	it("never moves a cursor backwards", async () => {
		const { writer, pushes } = setup();
		expect(writer.record("did:plc:space", "general", "3bbb")).toBe(true);
		expect(writer.record("did:plc:space", "general", "3aaa")).toBe(false);
		await writer.flush();
		expect(pushes.at(-1)).toEqual([{ channel: "general", cursor: "3bbb" }]);
	});

	it("keeps a newer server cursor over an older local one", async () => {
		const { writer, pushes } = setup([{ channel: "general", cursor: "3zzz" }]);
		writer.record("did:plc:space", "general", "3bbb");
		await writer.flush();
		expect(pushes.at(-1)).toEqual([{ channel: "general", cursor: "3zzz" }]);
	});

	it("pushes a cursor adopted from another session instead of an older local one", async () => {
		const { writer, pushes } = setup();
		writer.record("did:plc:space", "general", "3aaa");
		writer.adopt("did:plc:space", [{ channel: "general", cursor: "3ccc" }]);
		await writer.flush();
		expect(pushes.at(-1)).toEqual([{ channel: "general", cursor: "3ccc" }]);
		expect(writer.record("did:plc:space", "general", "3bbb")).toBe(false);
	});

	it("keeps a newer local cursor over an older adopted one", () => {
		const { writer } = setup();
		writer.record("did:plc:space", "general", "3ccc");
		writer.adopt("did:plc:space", [{ channel: "general", cursor: "3aaa" }]);
		expect(writer.recall("did:plc:space", "general")).toBe("3ccc");
	});

	it("debounces bursts of reads into one write", async () => {
		const { writer, pushes, advance, hydrations } = setup();
		writer.record("did:plc:space", "general", "3a01");
		await writer.flush();
		expect(pushes).toHaveLength(1);
		writer.record("did:plc:space", "general", "3a02");
		writer.record("did:plc:space", "general", "3a03");
		writer.record("did:plc:space", "general", "3a04");
		expect(pushes).toHaveLength(1);
		advance(READ_CURSOR_DEBOUNCE_MS);
		await writer.flush();
		expect(pushes).toHaveLength(2);
		expect(pushes.at(-1)).toEqual([{ channel: "general", cursor: "3a04" }]);
		expect(hydrations()).toBe(1);
	});

	it("still pushes to the AppView when the account record can't be written", async () => {
		const pushes: ChannelCursor[][] = [];
		const writer = createReadCursorWriter({
			hydrate: async () => [],
			persist: async () => {
				throw new Error("SpaceNotFound");
			},
			push: async (_community, cursors) => {
				pushes.push(cursors);
			},
		});
		writer.record("did:plc:space", "general", "3bbb");
		await writer.flush();
		expect(pushes).toEqual([[{ channel: "general", cursor: "3bbb" }]]);
	});
});
