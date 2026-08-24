import { createRoot } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { describe, expect, it } from "vitest";

type VideoTile = { did: string; source: string };

const makeStore = () =>
	createStore<{ videoStreams: Record<string, VideoTile> }>({
		videoStreams: {
			"self:screen": { did: "did:plc:me", source: "screen" },
			"producer-1": { did: "did:plc:other", source: "cam" },
		},
	});

describe("clearing a record in the voice store", () => {
	it("does not empty when handed a bare object, because the setter merges", () => {
		createRoot((dispose) => {
			const [data, setData] = makeStore();

			setData("videoStreams", {});

			expect(Object.keys(data.videoStreams)).toEqual([
				"self:screen",
				"producer-1",
			]);
			dispose();
		});
	});

	it("empties when handed reconcile, which is what resetState relies on", () => {
		createRoot((dispose) => {
			const [data, setData] = makeStore();

			setData("videoStreams", reconcile({}));

			expect(Object.keys(data.videoStreams)).toEqual([]);
			dispose();
		});
	});
});
