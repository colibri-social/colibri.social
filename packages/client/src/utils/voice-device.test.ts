import type { types } from "mediasoup-client";
import { afterEach, describe, expect, it } from "vitest";
import {
	isDeviceOutcome,
	pickVoiceHandler,
	supportsWebRtc,
	webKitFallbackHandler,
} from "./voice-device";

const TAURI_MACOS =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const SAFARI_MACOS =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15";
const IOS_WKWEBVIEW =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const CHROME_DESKTOP =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID_WEBVIEW =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";
const WEBKITGTK =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/8.0 Safari/605.1.15";
const FIREFOX =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0";
const OLD_CHROME =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36";

describe("pickVoiceHandler", () => {
	const cases: Array<[string, string | undefined, string | undefined]> = [
		["the bare Tauri macOS WKWebView user agent", TAURI_MACOS, "Safari12"],
		["desktop Safari", SAFARI_MACOS, "Safari12"],
		["the iOS WKWebView user agent", IOS_WKWEBVIEW, "Safari12"],
		["WebKitGTK on Linux", WEBKITGTK, "Safari12"],
		["desktop Chrome 131", CHROME_DESKTOP, "Chrome111"],
		["the Android Chromium WebView", ANDROID_WEBVIEW, "Chrome111"],
		["Firefox 133", FIREFOX, "Firefox120"],
		["Chrome 60", OLD_CHROME, undefined],
		["a missing user agent", undefined, undefined],
		["an unrecognised user agent", "SomeCrawler/1.0", undefined],
	];

	for (const [label, userAgent, expected] of cases) {
		it(`resolves ${label} to ${expected ?? "undefined"}`, () => {
			expect(pickVoiceHandler(userAgent, undefined)).toBe(expected);
		});
	}

	it("prefers Chromium reported by userAgentData over the WebKit fallback", () => {
		const userAgentData = {
			brands: [{ brand: "Chromium", version: "120" }],
			mobile: false,
			platform: "macOS",
		} as types.NavigatorUAData;

		expect(pickVoiceHandler(TAURI_MACOS, userAgentData)).toBe("Chrome111");
	});
});

describe("webKitFallbackHandler", () => {
	it("does not claim Chromium user agents", () => {
		expect(webKitFallbackHandler(CHROME_DESKTOP)).toBeUndefined();
		expect(webKitFallbackHandler(ANDROID_WEBVIEW)).toBeUndefined();
	});

	it("does not claim Firefox user agents", () => {
		expect(webKitFallbackHandler(FIREFOX)).toBeUndefined();
	});

	it("rejects WebKit builds older than 605", () => {
		expect(
			webKitFallbackHandler(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11) AppleWebKit/601.7.7 (KHTML, like Gecko)",
			),
		).toBeUndefined();
	});

	it("rejects user agents without an AppleWebKit version", () => {
		expect(webKitFallbackHandler("SomeCrawler/1.0")).toBeUndefined();
		expect(webKitFallbackHandler(undefined)).toBeUndefined();
	});
});

describe("supportsWebRtc", () => {
	const original = Reflect.get(globalThis, "RTCPeerConnection");

	afterEach(() => {
		if (original === undefined)
			Reflect.deleteProperty(globalThis, "RTCPeerConnection");
		else Reflect.set(globalThis, "RTCPeerConnection", original);
	});

	it("is true when the engine exposes RTCPeerConnection", () => {
		Reflect.set(globalThis, "RTCPeerConnection", class {});
		expect(supportsWebRtc()).toBe(true);
	});

	it("is false on an engine built without WebRTC", () => {
		Reflect.deleteProperty(globalThis, "RTCPeerConnection");
		expect(supportsWebRtc()).toBe(false);
	});
});

describe("isDeviceOutcome", () => {
	it("treats a machine with no matching input device as the user's own hardware", () => {
		expect(isDeviceOutcome("DeviceUnavailable")).toBe(true);
	});

	it("treats a refused permission prompt as the user's own choice", () => {
		expect(isDeviceOutcome("DevicePermissionDenied")).toBe(true);
	});

	it("leaves everything else worth reporting", () => {
		expect(isDeviceOutcome("Unexpected")).toBe(false);
		expect(isDeviceOutcome("VoiceStreamFailed")).toBe(false);
		expect(isDeviceOutcome("NetworkFailed")).toBe(false);
	});
});
