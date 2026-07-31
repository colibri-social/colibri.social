import { describe, expect, it } from "vitest";
import { redactData, redactText } from "./redact";

describe("redactText", () => {
	it("removes bearer tokens", () => {
		expect(redactText("Authorization: Bearer abc.def-ghi")).toBe(
			"Authorization: Bearer [redacted]",
		);
	});

	it("removes JWTs anywhere in the text", () => {
		const jwt = "eyJhbGciOi.eyJzdWIiOi.sig";
		expect(redactText(`token=${jwt} rest`)).toBe("token=[redacted] rest");
	});

	it("removes email addresses", () => {
		expect(redactText("mail louis@example.com now")).toBe(
			"mail [redacted] now",
		);
	});

	it("leaves ordinary text alone", () => {
		expect(redactText("could not reach the appview")).toBe(
			"could not reach the appview",
		);
	});
});

describe("redactData", () => {
	it("redacts values whose key looks sensitive", () => {
		expect(redactData({ accessToken: "abc", dpopKey: "xyz" })).toEqual({
			accessToken: "[redacted]",
			dpopKey: "[redacted]",
		});
	});

	it("keeps non-sensitive scalars", () => {
		expect(redactData({ status: 500, ok: false })).toEqual({
			status: 500,
			ok: false,
		});
	});

	it("summarises arrays by length rather than dumping them", () => {
		expect(redactData({ members: [1, 2, 3] })).toEqual({ members: 3 });
	});

	it("flattens an Error to name and message", () => {
		expect(redactData({ cause: new TypeError("Failed to fetch") })).toEqual({
			cause: "TypeError: Failed to fetch",
		});
	});

	it("recurses into nested objects", () => {
		expect(redactData({ outer: { password: "hunter2", keep: 1 } })).toEqual({
			outer: { password: "[redacted]", keep: 1 },
		});
	});

	it("stops recursing at a bounded depth", () => {
		const deep = { a: { b: { c: { d: { e: 1 } } } } };
		expect(redactData(deep)).toEqual({ a: { b: { c: { d: {} } } } });
	});

	it("is undefined when given nothing", () => {
		expect(redactData(undefined)).toBeUndefined();
	});
});
