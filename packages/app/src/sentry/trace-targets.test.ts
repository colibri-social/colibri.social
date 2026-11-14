import { DEFAULT_APPVIEW_URL } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { TRACE_PROPAGATION_TARGETS } from "./trace-targets";

const propagates = (url: string) => {
	return TRACE_PROPAGATION_TARGETS.some((target) => target.test(url));
};

describe("TRACE_PROPAGATION_TARGETS", () => {
	it("leaves native custom schemes alone", () => {
		expect(propagates("http://colibri-files.localhost/a.png")).toBe(false);
		expect(propagates("http://tauri.localhost/app")).toBe(false);
		expect(propagates("https://localhost.example.com/x")).toBe(false);
	});

	it("traces the local dev servers", () => {
		expect(propagates("http://localhost:5173/xrpc/foo")).toBe(true);
		expect(propagates("http://localhost/")).toBe(true);
	});

	it("traces Colibri services", () => {
		expect(propagates(`${DEFAULT_APPVIEW_URL}/xrpc/foo`)).toBe(true);
		expect(propagates("https://api.colibri.social/x")).toBe(true);
		expect(propagates("https://eu-1.nodes.colibri.social/x")).toBe(true);
	});
});
