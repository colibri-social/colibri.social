import { describe, expect, it, vi } from "vitest";
import { createDirtyGuard } from "./dirty-guard";

describe("createDirtyGuard", () => {
	it("leaves at once while nothing is dirty", () => {
		const guard = createDirtyGuard();
		guard.register({ dirty: () => false });
		const leave = vi.fn();
		guard.attempt(leave);
		expect(leave).toHaveBeenCalledOnce();
		expect(guard.prompting()).toBe(false);
	});

	it("holds a leave until the changes are discarded", () => {
		const guard = createDirtyGuard();
		const onDiscard = vi.fn();
		guard.register({ dirty: () => true, onDiscard });
		const leave = vi.fn();
		guard.attempt(leave);
		expect(leave).not.toHaveBeenCalled();
		expect(guard.prompting()).toBe(true);
		guard.discard();
		expect(onDiscard).toHaveBeenCalledOnce();
		expect(leave).toHaveBeenCalledOnce();
		expect(guard.prompting()).toBe(false);
	});

	it("drops the held leave when the person keeps editing", () => {
		const guard = createDirtyGuard();
		guard.register({ dirty: () => true });
		const leave = vi.fn();
		guard.attempt(leave);
		guard.keep();
		guard.discard();
		expect(leave).not.toHaveBeenCalled();
	});

	it("only asks about the sources a leave affects", () => {
		const guard = createDirtyGuard<{ dirty: () => boolean; depth: number }>();
		guard.register({ dirty: () => true, depth: 2 });
		expect(
			guard.hold(
				() => {},
				(source) => source.depth > 2,
			),
		).toBe(false);
		expect(
			guard.hold(
				() => {},
				(source) => source.depth > 1,
			),
		).toBe(true);
	});

	it("stops asking about a source once it unregisters", () => {
		const guard = createDirtyGuard();
		const release = guard.register({ dirty: () => true });
		release();
		expect(guard.isDirty()).toBe(false);
	});
});

describe("discard description", () => {
	it("names what a single source loses", () => {
		const guard = createDirtyGuard();
		guard.register({
			dirty: () => true,
			description: () => "This role won't be created.",
		});
		guard.attempt(() => {});
		expect(guard.description()).toBe("This role won't be created.");
	});

	it("falls back to the generic text when several sources are dirty", () => {
		const guard = createDirtyGuard();
		guard.register({ dirty: () => true, description: () => "One" });
		guard.register({ dirty: () => true, description: () => "Two" });
		guard.attempt(() => {});
		expect(guard.description()).toBeUndefined();
	});
});
