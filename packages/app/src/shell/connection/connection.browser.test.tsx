import "../../app.css";
import { CONNECTION_CARD_INSET } from "@colibri-social/ui";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { LiveStatus } from "../../data/remote/live";
import { Providers } from "../../providers";
import {
	CONNECTION_GRACE_MS,
	ConnectionStatus,
	RETRY_FEEDBACK_MS,
} from "./ConnectionStatus";

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;

afterEach(() => {
	vi.useRealTimers();
	dispose?.();
	dispose = undefined;
	document.body.innerHTML = "";
});

const JARGON = /appview|server|socket|frame|websocket|xrpc/i;

const mount = (
	initial: LiveStatus,
	options: {
		online?: boolean;
		retryAt?: number;
		platform?: "mobile" | "desktop";
	} = {},
) => {
	const [status, setStatus] = createSignal<LiveStatus>(initial);
	const [online, setOnline] = createSignal(options.online);
	const onRetry = vi.fn();
	const host = document.createElement("div");
	host.style.cssText = "position: relative; width: 402px; height: 600px;";
	document.body.append(host);
	dispose = render(
		() => (
			<Providers>
				<ConnectionStatus
					status={status()}
					online={online()}
					retryAt={options.retryAt}
					onRetry={onRetry}
					platform={options.platform ?? "mobile"}
				/>
			</Providers>
		),
		host,
	);
	return { host, setStatus, setOnline, onRetry };
};

const slot = () =>
	document.querySelector<HTMLElement>("[data-connection-card-slot]");
const card = () =>
	document.querySelector<HTMLElement>("[data-connection-card]");
const visible = () => slot()?.hasAttribute("data-visible") ?? false;
const retryButton = () =>
	document.querySelector<HTMLButtonElement>("[data-connection-card-retry]");

it("waits out the grace period before showing a reconnect", () => {
	vi.useFakeTimers();
	const { setStatus } = mount("open", { online: true });
	expect(visible()).toBe(false);
	expect(slot()?.hasAttribute("inert")).toBe(true);
	setStatus("reconnecting");
	vi.advanceTimersByTime(CONNECTION_GRACE_MS - 1);
	expect(visible()).toBe(false);
	vi.advanceTimersByTime(1);
	expect(visible()).toBe(true);
	expect(card()?.dataset.connectionCard).toBe("reconnecting");
	expect(card()?.getAttribute("role")).toBe("status");
	expect(card()?.textContent).toContain("Reconnecting");
	expect(card()?.textContent).toContain(
		"New messages show up once you're connected",
	);
	expect(card()?.textContent).not.toMatch(JARGON);
	expect(retryButton()).toBeNull();
});

it("never shows a blip that recovers within the grace period", () => {
	vi.useFakeTimers();
	const { setStatus } = mount("open", { online: true });
	setStatus("reconnecting");
	vi.advanceTimersByTime(CONNECTION_GRACE_MS / 2);
	setStatus("open");
	vi.advanceTimersByTime(CONNECTION_GRACE_MS * 2);
	expect(visible()).toBe(false);
});

it("hides as soon as the connection is back", () => {
	vi.useFakeTimers();
	const { setStatus } = mount("reconnecting", { online: true });
	vi.advanceTimersByTime(CONNECTION_GRACE_MS);
	expect(visible()).toBe(true);
	setStatus("open");
	expect(visible()).toBe(false);
});

it("says offline right away", () => {
	mount("reconnecting", { online: false });
	expect(visible()).toBe(true);
	expect(card()?.dataset.connectionCard).toBe("offline");
	expect(card()?.textContent).toContain("You're offline");
	expect(retryButton()).toBeNull();
	expect(card()?.textContent).not.toMatch(JARGON);
});

it("counts down to the next attempt and retries on request", async () => {
	const { onRetry } = mount("unreachable", {
		online: true,
		retryAt: Date.now() + 9_000,
	});
	await until(() => visible(), CONNECTION_GRACE_MS + 2000);
	expect(card()?.dataset.connectionCard).toBe("unreachable");
	expect(card()?.textContent).toContain("Can't connect right now");
	expect(card()?.textContent).toMatch(/Trying again in \d+ s/);
	const retry = retryButton();
	if (!retry) throw new Error("no retry button");
	await userEvent.click(retry);
	expect(onRetry).toHaveBeenCalledTimes(1);
	await until(() => retry.getAttribute("aria-busy") === "true");
	expect(retry.disabled).toBe(true);
});

it("clears the retry feedback when the status moves on", () => {
	vi.useFakeTimers();
	const { setStatus } = mount("unreachable", { online: true });
	vi.advanceTimersByTime(CONNECTION_GRACE_MS);
	retryButton()?.click();
	expect(retryButton()?.getAttribute("aria-busy")).toBe("true");
	setStatus("reconnecting");
	setStatus("unreachable");
	expect(retryButton()?.getAttribute("aria-busy")).toBeNull();
	retryButton()?.click();
	vi.advanceTimersByTime(RETRY_FEEDBACK_MS);
	expect(retryButton()?.getAttribute("aria-busy")).toBeNull();
});

it("sits at the card inset inside its pane", async () => {
	const { host } = mount("reconnecting", { online: false });
	const element = card();
	if (!element) throw new Error("no card");
	await until(() => getComputedStyle(slot() as HTMLElement).opacity === "1");
	const box = element.getBoundingClientRect();
	const pane = host.getBoundingClientRect();
	const inset = CONNECTION_CARD_INSET.mobile;
	expect(Math.abs(box.top - pane.top - inset.top)).toBeLessThan(1);
	expect(Math.abs(box.left - pane.left - inset.side)).toBeLessThan(1);
	expect(Math.abs(pane.right - box.right - inset.side)).toBeLessThan(1);
});
