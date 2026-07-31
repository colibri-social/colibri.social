import { describe, expect, it } from "vitest";
import {
	classifyNativeError,
	isNativeErrorEnvelope,
	wasCancelled,
} from "./native";

describe("isNativeErrorEnvelope", () => {
	it("accepts the shape the Rust side serializes", () => {
		expect(
			isNativeErrorEnvelope({ code: "Cancelled", message: "closed" }),
		).toBe(true);
	});

	it("rejects a bare string, which is what the old command returned", () => {
		expect(isNativeErrorEnvelope("canceled")).toBe(false);
	});

	it("rejects an unknown code", () => {
		expect(isNativeErrorEnvelope({ code: "Whatever", message: "x" })).toBe(
			false,
		);
	});
});

describe("wasCancelled", () => {
	it("is true only for the cancelled code", () => {
		expect(wasCancelled({ code: "Cancelled", message: "closed" })).toBe(true);
		expect(wasCancelled({ code: "Failed", message: "boom" })).toBe(false);
	});

	it("is false for a bare string", () => {
		expect(wasCancelled("canceled")).toBe(false);
	});
});

describe("classifyNativeError", () => {
	it("maps each native code onto a client code", () => {
		const cases = [
			["Cancelled", "NativeCancelled"],
			["Unsupported", "NativeUnavailable"],
			["InvalidRequest", "InvalidRequest"],
			["Failed", "NativeFailed"],
		] as const;

		for (const [native, expected] of cases) {
			const err = classifyNativeError(
				{ code: native, message: "detail" },
				"start_web_auth",
			);
			expect(err.code, native).toBe(expected);
			expect(err.method).toBe("start_web_auth");
			expect(err.serverMessage).toBe("detail");
		}
	});

	it("falls back for anything that is not the envelope", () => {
		const err = classifyNativeError(new Error("boom"), "start_web_auth");
		expect(err.code).toBe("NativeFailed");
		expect(err.message).toBe("boom");
	});
});
