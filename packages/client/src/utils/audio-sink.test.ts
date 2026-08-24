import { describe, expect, it, vi } from "vitest";
import {
	applyAudioSink,
	DEFAULT_SINK_ID,
	type SinkableMediaElement,
} from "./audio-sink";

const routableElement = (
	sinkId = "",
	reject?: (id: string) => boolean,
): SinkableMediaElement & { setSinkId: ReturnType<typeof vi.fn> } => {
	const el = {
		sinkId,
		setSinkId: vi.fn(async (id: string) => {
			if (reject?.(id)) throw new Error("NotFoundError");
			el.sinkId = id;
		}),
	};

	return el;
};

describe("applyAudioSink", () => {
	it("pins a freshly created element to the default sink", async () => {
		const el = routableElement();

		await expect(applyAudioSink(el, undefined)).resolves.toBe(DEFAULT_SINK_ID);
		expect(el.setSinkId).toHaveBeenCalledWith(DEFAULT_SINK_ID);
	});

	it("routes to the configured speaker", async () => {
		const el = routableElement();

		await expect(applyAudioSink(el, "speaker-1")).resolves.toBe("speaker-1");
		expect(el.setSinkId).toHaveBeenCalledWith("speaker-1");
	});

	it("falls back to the default sink when the speaker is gone", async () => {
		const el = routableElement("", (id) => id === "unplugged");

		await expect(applyAudioSink(el, "unplugged")).resolves.toBe(
			DEFAULT_SINK_ID,
		);
		expect(el.setSinkId).toHaveBeenLastCalledWith(DEFAULT_SINK_ID);
	});

	it("rejects when even the default sink cannot be selected", async () => {
		const el = routableElement("", () => true);

		await expect(applyAudioSink(el, undefined)).rejects.toThrow();
	});

	it("skips a redundant reroute", async () => {
		const el = routableElement("speaker-1");

		await applyAudioSink(el, "speaker-1");
		expect(el.setSinkId).not.toHaveBeenCalled();
	});

	it("reroutes an unchanged sink when forced", async () => {
		const el = routableElement(DEFAULT_SINK_ID);

		await applyAudioSink(el, undefined, { force: true });
		expect(el.setSinkId).toHaveBeenCalledWith(DEFAULT_SINK_ID);
	});

	it("does nothing on engines without sink selection", async () => {
		await expect(applyAudioSink({}, "speaker-1")).resolves.toBeNull();
	});
});
