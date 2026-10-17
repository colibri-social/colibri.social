import { createSignal } from "solid-js";
import { expect, it } from "vitest";
import type { NotificationView } from "../data/types";
import { badgeCount, installBadge } from "./badge";

const view = (
	id: string,
	overrides: Partial<NotificationView> = {},
): NotificationView =>
	({
		id,
		kind: "mention",
		community: "did:plc:hq",
		...overrides,
	}) as unknown as NotificationView;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it("counts unread mentions and replies outside muted Spaces", () => {
	const items = [
		view("a"),
		view("b", { kind: "reply" }),
		view("c", { kind: "message" }),
		view("d", { seenAt: "2026-10-17T00:00:00.000Z" }),
		view("e", { community: "did:plc:muted" }),
	];
	expect(badgeCount(items, (space) => space === "did:plc:muted")).toBe(2);
});

it("debounces updates and clears the badge on uninstall", async () => {
	const [items, setItems] = createSignal<NotificationView[]>([view("a")]);
	const counts: number[] = [];
	const uninstall = installBadge(
		{
			notifications: { items },
			spaceNotifications: { isMuted: () => false },
		} as never,
		{
			delayMs: 20,
			set: async (count) => {
				counts.push(count);
			},
		},
	);
	setItems([view("a"), view("b")]);
	setItems([view("a"), view("b"), view("c")]);
	await wait(60);
	expect(counts).toEqual([3]);
	setItems([view("a"), view("b"), view("c")]);
	await wait(60);
	expect(counts).toEqual([3]);
	uninstall();
	expect(counts).toEqual([3, 0]);
});
