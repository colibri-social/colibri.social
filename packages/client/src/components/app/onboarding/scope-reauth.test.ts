import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearScopeReauthAttempts,
	MAX_SCOPE_REAUTH_ATTEMPTS,
	noteScopeReauthAttempt,
	scopeReauthAttempts,
	scopeReauthExhausted,
} from "./scope-reauth";

const store = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value),
	removeItem: (key: string) => void store.delete(key),
});

beforeEach(() => store.clear());

describe("scope re-auth attempts", () => {
	it("starts at zero and is not exhausted", () => {
		expect(scopeReauthAttempts()).toBe(0);
		expect(scopeReauthExhausted()).toBe(false);
	});

	it("counts up and only gives up at the limit", () => {
		for (let i = 1; i < MAX_SCOPE_REAUTH_ATTEMPTS; i++) {
			noteScopeReauthAttempt();
			expect(scopeReauthAttempts()).toBe(i);
			expect(scopeReauthExhausted()).toBe(false);
		}

		noteScopeReauthAttempt();
		expect(scopeReauthAttempts()).toBe(MAX_SCOPE_REAUTH_ATTEMPTS);
		expect(scopeReauthExhausted()).toBe(true);
	});

	it("reads a legacy flag as a single attempt", () => {
		store.set("colibri:scope-reauth", "1");
		expect(scopeReauthAttempts()).toBe(1);
	});

	it("treats an unparseable value as one attempt rather than zero", () => {
		store.set("colibri:scope-reauth", "nonsense");
		expect(scopeReauthAttempts()).toBe(1);
	});

	it("clears back to zero", () => {
		noteScopeReauthAttempt();
		clearScopeReauthAttempts();
		expect(scopeReauthAttempts()).toBe(0);
	});
});

describe("when sessionStorage is unavailable", () => {
	it("reports no attempts instead of throwing", () => {
		vi.stubGlobal("sessionStorage", {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("denied");
			},
			removeItem: () => {
				throw new Error("denied");
			},
		});

		expect(scopeReauthAttempts()).toBe(0);
		expect(() => noteScopeReauthAttempt()).not.toThrow();
		expect(() => clearScopeReauthAttempts()).not.toThrow();
	});
});
