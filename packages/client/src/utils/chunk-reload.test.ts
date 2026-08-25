import { describe, expect, it, vi } from "vitest";
import {
	CHUNK_RELOAD_KEY,
	type ChunkReloadStore,
	reloadOnceForChunkFailure,
} from "./chunk-reload";

const memoryStore = (): ChunkReloadStore => {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
	};
};

const throwingStore = (): ChunkReloadStore => ({
	getItem: () => {
		throw new Error("storage is disabled");
	},
	setItem: () => {
		throw new Error("storage is disabled");
	},
});

describe("reloadOnceForChunkFailure", () => {
	it("reloads on the first failure", () => {
		const reload = vi.fn();
		const store = memoryStore();

		expect(reloadOnceForChunkFailure({ store, reload })).toBe(true);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(store.getItem(CHUNK_RELOAD_KEY)).toBe("1");
	});

	it("does not reload again in the same session", () => {
		const reload = vi.fn();
		const store = memoryStore();

		reloadOnceForChunkFailure({ store, reload });
		expect(reloadOnceForChunkFailure({ store, reload })).toBe(false);
		expect(reloadOnceForChunkFailure({ store, reload })).toBe(false);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("honours a mark left by an earlier page load", () => {
		const reload = vi.fn();
		const store = memoryStore();
		store.setItem(CHUNK_RELOAD_KEY, "1");

		expect(reloadOnceForChunkFailure({ store, reload })).toBe(false);
		expect(reload).not.toHaveBeenCalled();
	});

	it("stays quiet when storage throws", () => {
		const reload = vi.fn();

		expect(() =>
			reloadOnceForChunkFailure({ store: throwingStore(), reload }),
		).not.toThrow();
		expect(reloadOnceForChunkFailure({ store: throwingStore(), reload })).toBe(
			false,
		);
		expect(reload).not.toHaveBeenCalled();
	});

	it("stays quiet when there is no storage at all", () => {
		const reload = vi.fn();

		expect(reloadOnceForChunkFailure({ store: undefined, reload })).toBe(false);
		expect(reload).not.toHaveBeenCalled();
	});

	it("reports no reload when reloading itself throws", () => {
		const store = memoryStore();
		const reload = () => {
			throw new Error("navigation blocked");
		};

		expect(reloadOnceForChunkFailure({ store, reload })).toBe(false);
	});
});
