import "../app.css";
import {
	markReportDelivered,
	resetReportDeliveries,
} from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureFeedback = vi.fn((_feedback: unknown) => "");

vi.mock("@sentry/solid", () => {
	const scope = {
		setUser: () => scope,
		setTag: () => scope,
	};
	return {
		captureFeedback: (feedback: unknown) => captureFeedback(feedback),
		withScope: (fn: (s: typeof scope) => unknown) => fn(scope),
	};
});

const { CrashReport } = await import("./CrashReport");
const { setReportingAccount } = await import("./account");

const EVENT = "3f9a2c71e4b04d8a9c1e6b2f7d5a0e13";
const DID = "did:plc:testuser";

let dispose: (() => void) | undefined;

const mount = (eventId: string | undefined) => {
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(() => <CrashReport eventId={eventId} />, host);
	return host;
};

const sendButton = (host: HTMLElement) =>
	[...host.querySelectorAll("button")].find((button) =>
		button.textContent?.includes("Send my account with this report"),
	);

afterEach(() => {
	dispose?.();
	document.body.innerHTML = "";
	resetReportDeliveries();
	setReportingAccount({ did: undefined, optedIn: false });
	captureFeedback.mockClear();
});

describe("CrashReport", () => {
	it("stays hidden until the report reaches the error service", () => {
		setReportingAccount({ did: DID, optedIn: false });
		const host = mount(EVENT);
		expect(host.querySelector("[data-error-report]")).toBeNull();
		markReportDelivered(EVENT);
		expect(host.querySelector("[data-error-report]")).not.toBeNull();
		expect(host.querySelector<HTMLInputElement>("input")?.value).toBe(EVENT);
	});

	it("stays hidden without a reference", () => {
		const host = mount(undefined);
		expect(host.querySelector("[data-error-report]")).toBeNull();
	});

	it("attaches the account to this report on request", () => {
		setReportingAccount({ did: DID, optedIn: false });
		markReportDelivered(EVENT);
		const host = mount(EVENT);
		sendButton(host)?.click();
		expect(captureFeedback).toHaveBeenCalledWith(
			expect.objectContaining({ associatedEventId: EVENT }),
		);
		expect(sendButton(host)).toBeUndefined();
		expect(host.textContent).toContain(
			"Your account was added to this report. Thank you.",
		);
	});

	it("says the account is already included when the setting is on", () => {
		setReportingAccount({ did: DID, optedIn: true });
		markReportDelivered(EVENT);
		const host = mount(EVENT);
		expect(sendButton(host)).toBeUndefined();
		expect(host.textContent).toContain(
			"Your account is already included in this report.",
		);
	});

	it("offers nothing about the account when signed out", () => {
		markReportDelivered(EVENT);
		const host = mount(EVENT);
		expect(host.querySelector("[data-error-report-account]")).toBeNull();
	});
});
