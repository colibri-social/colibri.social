import { describe, expect, it } from "vitest";
import type { MockSource } from "../../data/mock/source";
import type { DataStore } from "../../data/store";
import type { Did, MessageView, SpaceRef, ThreadView } from "../../data/types";
import {
	DEV_PATH,
	HQ,
	mount,
	TEXT,
	until,
	wait,
} from "../channel/desktop-test-kit";

const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;

const paneHost = () =>
	document.querySelector<HTMLElement>("[data-shell-thread]");

const threadView = () =>
	paneHost()?.querySelector<HTMLElement>("[data-thread-view]") ?? null;

const anchorElement = () =>
	paneHost()?.querySelector<HTMLElement>("[data-thread-anchor] article") ??
	null;

const rows = () =>
	new Map(
		Array.from(
			paneHost()?.querySelectorAll<HTMLElement>(
				"[data-message-list-scroller] article[data-message-key]",
			) ?? [],
		)
			.filter((element) => !element.closest("[data-thread-anchor]"))
			.map((element) => [element.dataset.messageKey ?? "", element]),
	);

const rowWithText = (text: string) =>
	Array.from(rows().values()).find((element) =>
		element.textContent?.includes(text),
	);

type Snapshot = {
	view: HTMLElement | null;
	anchor: HTMLElement | null;
	rows: Map<string, HTMLElement>;
};

const snapshot = (): Snapshot => ({
	view: threadView(),
	anchor: anchorElement(),
	rows: rows(),
});

const remounted = (before: Snapshot, except: readonly string[] = []) => {
	const after = rows();
	const changed: string[] = [];
	if (threadView() !== before.view) changed.push("view");
	if (anchorElement() !== before.anchor) changed.push("anchor");
	for (const [key, element] of before.rows) {
		if (except.includes(key)) continue;
		if (after.get(key) !== element) changed.push(key);
	}
	return changed;
};

const openThread = async () => {
	const mounted = await mount(`${DEV_PATH}/t/spring-tuning`);
	const record = mounted.source.world.spaces
		.flatMap((space) => space.threads)
		.find((entry) => entry.view.name === "Spring tuning");
	if (!record) throw new Error("Seed changed");
	const author = mounted.source.world.spaces
		.find((entry) => entry.did === HQ)
		?.members.find(
			(member) => member.actor.did !== mounted.source.world.viewerDid,
		)?.actor.did;
	if (!author) throw new Error("Seed changed");
	await until(() => !!anchorElement() && rows().size > 1);
	await wait(400);
	return { ...mounted, record, author };
};

const arriveInThread = (
	source: MockSource,
	record: { view: ThreadView },
	author: Did,
	text: string,
) => {
	const message = source.simulateMessage({
		author,
		channel: record.view.space,
		text,
	});
	record.view = {
		...record.view,
		messageCount: (record.view.messageCount ?? 0) + 1,
		lastActivityAt: message.createdAt,
	} as ThreadView;
	source.emit({ $type: "threadEvent", event: "update", thread: record.view });
	return message;
};

const lastRowMessage = (store: DataStore, ref: SpaceRef) =>
	store.channel(ref).messages().at(-1) as MessageView;

describe("thread pane under live updates", () => {
	it("mounts only the new row when a message arrives in the thread", async () => {
		const { source, record, author } = await openThread();
		const before = snapshot();
		expect(before.rows.size).toBeGreaterThan(1);

		arriveInThread(source, record, author, "Fresh reply in the thread");
		await until(() => !!rowWithText("Fresh reply in the thread"));
		await wait(300);

		expect(remounted(before)).toEqual([]);
		expect(rows().size).toBe(before.rows.size + 1);
	});

	it("keeps every row when a message arrives in the parent channel", async () => {
		const { source, author } = await openThread();
		const before = snapshot();

		source.simulateMessage({
			author,
			channel: DEV_REF,
			text: "Unrelated channel chatter",
		});
		await wait(400);

		expect(remounted(before)).toEqual([]);
	});

	it("keeps every row when the channel, Space or thread record updates", async () => {
		const { source, record } = await openThread();
		const space = source.world.spaces.find((entry) => entry.did === HQ);
		const channel = space?.channels.find(
			(entry) => entry.view.space === DEV_REF,
		);
		if (!space || !channel) throw new Error("Seed changed");
		const before = snapshot();

		source.emit({
			$type: "channelEvent",
			event: "update",
			community: space.did,
			channel: { ...channel.view },
		});
		await wait(300);
		source.emit({
			$type: "communityEvent",
			event: "update",
			community: { ...space.view },
		});
		await wait(300);
		record.view = {
			...record.view,
			lastActivityAt: new Date().toISOString(),
		} as ThreadView;
		source.emit({ $type: "threadEvent", event: "update", thread: record.view });
		await wait(300);

		expect(remounted(before)).toEqual([]);
	});

	it("keeps the stored anchor when the thread record arrives as a fresh copy", async () => {
		const { source, record } = await openThread();
		const anchor = record.view.anchor;
		const stored = record.view.anchorMessage;
		if (!anchor || !stored) throw new Error("Seed changed");
		record.view = {
			...record.view,
			anchor: { ...anchor, rkey: "3zzzzzzzzzzzz" },
			anchorMessage: { ...stored, rkey: "3zzzzzzzzzzzz" },
		} as ThreadView;
		source.emit({ $type: "threadEvent", event: "update", thread: record.view });
		await until(() => !!anchorElement());
		await wait(400);
		const before = snapshot();

		for (let index = 0; index < 3; index++) {
			source.emit({
				$type: "threadEvent",
				event: "update",
				thread: structuredClone(record.view),
			});
			await wait(150);
		}
		await wait(300);

		expect(remounted(before)).toEqual([]);
	});

	it("keeps every row while someone types, reacts and edits", async () => {
		const { source, store, record, author } = await openThread();
		const target = lastRowMessage(store, record.view.space);
		const before = snapshot();

		source.emit({
			$type: "typingEvent",
			did: author,
			channel: record.view.space,
		});
		await wait(300);
		expect(remounted(before)).toEqual([]);

		source.emit({
			$type: "reactionEvent",
			event: "create",
			channel: record.view.space,
			target: { did: target.author.did, rkey: target.rkey },
			emoji: "🦉",
			actor: author,
		});
		await until(
			() =>
				!!before.rows.get(target.rkey)?.textContent?.includes("🦉") ||
				!!rows().get(target.rkey)?.textContent?.includes("🦉"),
		);
		await wait(200);
		expect(remounted(before)).toEqual([]);

		source.emit({
			$type: "messageEvent",
			event: "update",
			channel: record.view.space,
			message: {
				...target,
				text: "Edited while you watched",
				updatedAt: new Date().toISOString(),
			} as MessageView,
		});
		await until(() => !!rowWithText("Edited while you watched"));
		await wait(200);
		expect(remounted(before)).toEqual([]);
	});
});
