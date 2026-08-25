import { describe, expect, it } from "vitest";
import { createProducerRegistry } from "./producer-registry";

type Owner = { did: string };

const withProducers = () => {
	const registry = createProducerRegistry<Owner>();
	registry.track("p1", { did: "did:plc:alice" });
	registry.track("p2", { did: "did:plc:bob" });
	return registry;
};

describe("producer registry", () => {
	it("hands the queued producers to the drain exactly once", () => {
		const registry = withProducers();

		registry.queue("p1");
		registry.queue("p2");

		expect(registry.drain()).toEqual(["p1", "p2"]);
		expect(registry.drain()).toEqual([]);
	});

	it("ignores a producer that is queued twice", () => {
		const registry = withProducers();

		registry.queue("p1");
		registry.queue("p1");

		expect(registry.drain()).toEqual(["p1"]);
	});

	it("drops a removed producer from the queue, so the drain skips it", () => {
		const registry = withProducers();

		registry.queue("p1");
		registry.queue("p2");
		registry.remove("p1");

		expect(registry.has("p1")).toBe(false);
		expect(registry.owner("p1")).toBeUndefined();
		expect(registry.drain()).toEqual(["p2"]);
	});

	it("drops every producer of a peer that left", () => {
		const registry = withProducers();
		registry.queue("p1");
		registry.queue("p2");

		for (const [producerId, owner] of registry.entries()) {
			if (owner.did === "did:plc:alice") registry.remove(producerId);
		}

		expect(registry.pending()).toEqual(["p2"]);
	});

	it("empties on clear", () => {
		const registry = withProducers();
		registry.queue("p1");

		registry.clear();

		expect(registry.entries()).toEqual([]);
		expect(registry.pending()).toEqual([]);
	});
});
