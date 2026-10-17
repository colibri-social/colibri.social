import type {
	ScreenShareFramerate,
	ScreenShareResolution,
} from "@colibri-social/ui";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_SCREEN_SHARE,
	displayMediaRequest,
	isScreenShareOptions,
	SCREEN_SHARE_FRAMERATES,
	SCREEN_SHARE_RESOLUTIONS,
	screenCodecOptions,
	screenContentHint,
	screenDegradationPreference,
	screenEncodings,
	screenMaxBitrate,
	screenVideoConstraints,
	supportsDisplayAudio,
} from "./screen-share";

const TAURI_MACOS =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const SAFARI_MACOS =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15";
const CHROME_DESKTOP =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const EDGE_WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const FIREFOX =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0";

describe("screenVideoConstraints", () => {
	it("caps height for fixed resolutions without constraining width", () => {
		const constraints = screenVideoConstraints({
			resolution: "1080",
			framerate: 30,
		});

		expect(constraints.height).toEqual({ ideal: 1080, max: 1080 });
		expect(constraints.width).toBeUndefined();
	});

	it("leaves height unconstrained at source resolution", () => {
		const constraints = screenVideoConstraints({
			resolution: "source",
			framerate: 60,
		});

		expect(constraints.height).toBeUndefined();
		expect(constraints.frameRate).toEqual({ ideal: 60, max: 60 });
	});

	it("never uses exact so a smaller source still shares", () => {
		for (const resolution of SCREEN_SHARE_RESOLUTIONS) {
			for (const framerate of SCREEN_SHARE_FRAMERATES) {
				const serialized = JSON.stringify(
					screenVideoConstraints({ resolution, framerate }),
				);
				expect(serialized).not.toContain("exact");
			}
		}
	});
});

describe("screenMaxBitrate", () => {
	it("returns a bitrate for every ladder combination", () => {
		for (const resolution of SCREEN_SHARE_RESOLUTIONS) {
			for (const framerate of SCREEN_SHARE_FRAMERATES) {
				expect(screenMaxBitrate({ resolution, framerate })).toBeGreaterThan(0);
			}
		}
	});

	it("rises with framerate at a fixed resolution", () => {
		const at = (framerate: ScreenShareFramerate): number =>
			screenMaxBitrate({ resolution: "1080", framerate });

		expect(at(15)).toBeLessThan(at(30));
		expect(at(30)).toBeLessThan(at(60));
	});

	it("rises with resolution at a fixed framerate", () => {
		const at = (resolution: ScreenShareResolution): number =>
			screenMaxBitrate({ resolution, framerate: 30 });

		expect(at("720")).toBeLessThan(at("1080"));
		expect(at("1080")).toBeLessThan(at("1440"));
	});
});

describe("screenEncodings and screenCodecOptions", () => {
	it("produces a single encoding capped at the ladder bitrate", () => {
		const quality = { resolution: "1440", framerate: 30 } as const;
		expect(screenEncodings(quality)).toEqual([
			{ maxBitrate: screenMaxBitrate(quality) },
		]);
	});

	it("starts the encoder at half the ceiling in kbps", () => {
		const quality = { resolution: "1080", framerate: 30 } as const;
		expect(screenCodecOptions(quality)).toEqual({
			videoGoogleStartBitrate: Math.round(screenMaxBitrate(quality) / 2000),
		});
	});
});

describe("content hint and degradation preference", () => {
	it("favours detail at 15 fps", () => {
		const quality = { resolution: "1080", framerate: 15 } as const;
		expect(screenContentHint(quality)).toBe("detail");
		expect(screenDegradationPreference(quality)).toBe("maintain-resolution");
	});

	it("favours motion above 15 fps", () => {
		for (const framerate of [30, 60] as const) {
			const quality = { resolution: "1080", framerate } as const;
			expect(screenContentHint(quality)).toBe("motion");
			expect(screenDegradationPreference(quality)).toBe("maintain-framerate");
		}
	});
});

describe("displayMediaRequest", () => {
	it("asks for audio and system audio when sharing sound", () => {
		const request = displayMediaRequest({
			resolution: "1080",
			framerate: 30,
			shareAudio: true,
		});

		expect(request.audio).toBe(true);
		expect(request.systemAudio).toBe("include");
	});

	it("excludes system audio when not sharing sound", () => {
		const request = displayMediaRequest({
			resolution: "1080",
			framerate: 30,
			shareAudio: false,
		});

		expect(request.audio).toBe(false);
		expect(request.systemAudio).toBe("exclude");
	});

	it("always excludes the app's own surface", () => {
		const request = displayMediaRequest({
			resolution: "720",
			framerate: 15,
			shareAudio: false,
		});

		expect(request.selfBrowserSurface).toBe("exclude");
	});
});

describe("isScreenShareOptions", () => {
	it("accepts the defaults and every ladder combination", () => {
		expect(isScreenShareOptions(DEFAULT_SCREEN_SHARE)).toBe(true);
		for (const resolution of SCREEN_SHARE_RESOLUTIONS) {
			for (const framerate of SCREEN_SHARE_FRAMERATES) {
				expect(
					isScreenShareOptions({ resolution, framerate, shareAudio: true }),
				).toBe(true);
			}
		}
	});

	it("rejects unknown values", () => {
		for (const value of [
			undefined,
			null,
			{ resolution: "4k", framerate: 30, shareAudio: false },
			{ resolution: "1080", framerate: 24, shareAudio: false },
			{ resolution: "1080", framerate: 30 },
		]) {
			expect(isScreenShareOptions(value)).toBe(false);
		}
	});
});

describe("supportsDisplayAudio", () => {
	it("accepts Chromium engines", () => {
		expect(supportsDisplayAudio(CHROME_DESKTOP)).toBe(true);
		expect(supportsDisplayAudio(EDGE_WINDOWS)).toBe(true);
	});

	it("rejects WebKit, which has no display audio at all", () => {
		expect(supportsDisplayAudio(SAFARI_MACOS)).toBe(false);
		expect(supportsDisplayAudio(TAURI_MACOS)).toBe(false);
	});

	it("rejects Firefox and a missing user agent", () => {
		expect(supportsDisplayAudio(FIREFOX)).toBe(false);
		expect(supportsDisplayAudio(undefined)).toBe(false);
	});
});
