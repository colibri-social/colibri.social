import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import {
	createMediaLinkRefresher,
	findMediaHolder,
	type MediaLinkFeed,
	mediaLinkTarget,
} from "./media-link";
import type { MessagePage } from "./source";
import type { AttachmentView, MessageView, SpaceRef } from "./types";

const CHANNEL =
	"at://did:plc:owner/space/social.colibri.beta.channel.text/general" as SpaceRef;

const signed = (cid: string, exp: number) =>
	`https://appview.test/xrpc/social.colibri.beta.blob.get?did=did%3Aplc%3Aauthor&cid=${cid}&space=x&viewer=did%3Aplc%3Aviewer&exp=${exp}&sig=s${exp}`;

const message = (rkey: string, urls: string[], forward: string[] = []) =>
	({
		rkey,
		attachments: urls.map(
			(url) => ({ url, mimeType: "video/mp4" }) as AttachmentView,
		),
		...(forward.length > 0
			? {
					forward: {
						attachments: forward.map(
							(url) => ({ url, mimeType: "image/png" }) as AttachmentView,
						),
					},
				}
			: {}),
	}) as unknown as MessageView;

const feedOf = (initial: MessageView[]) => {
	const [messages, setMessages] = createSignal<readonly MessageView[]>(initial);
	const attach = vi.fn((incoming: readonly MessageView[]) => {
		const fresh = new Map(incoming.map((entry) => [entry.rkey, entry]));
		setMessages((list) => list.map((entry) => fresh.get(entry.rkey) ?? entry));
	});
	const feed: MediaLinkFeed = { channel: CHANNEL, messages, attach };
	return { feed, attach, messages };
};

const page = (items: MessageView[]): MessagePage => ({ items });

describe("mediaLinkTarget", () => {
	it("drops the signature and expiry but keeps the blob identity", () => {
		const target = mediaLinkTarget(signed("bafy1", 100));
		expect(target).toBe(mediaLinkTarget(signed("bafy1", 200)));
		expect(target).not.toContain("sig=");
		expect(target).toContain("cid=bafy1");
	});

	it("passes unparseable links through", () => {
		expect(mediaLinkTarget("not a url")).toBe("not a url");
	});
});

describe("findMediaHolder", () => {
	it("finds the message by attachment or forwarded attachment", () => {
		const list = [
			message("a", [signed("one", 1)]),
			message("b", [], [signed("two", 1)]),
		];
		expect(findMediaHolder(list, signed("one", 9))?.rkey).toBe("a");
		expect(findMediaHolder(list, signed("two", 9))?.rkey).toBe("b");
		expect(findMediaHolder(list, signed("three", 9))).toBeUndefined();
	});
});

describe("createMediaLinkRefresher", () => {
	it("refetches the holding message once and adopts the fresh link", async () => {
		const stale = signed("one", 100);
		const fresh = signed("one", 200);
		const { feed, attach, messages } = feedOf([
			message("a", [stale]),
			message("b", []),
		]);
		const listMessages = vi.fn(async () =>
			page([message("a", [fresh]), message("z", [])]),
		);
		const links = createMediaLinkRefresher({
			feed: () => feed,
			listMessages,
			now: () => 150_000,
		});

		await expect(links.refresh(stale)).resolves.toBe(true);
		expect(listMessages).toHaveBeenCalledWith(
			expect.objectContaining({ channel: CHANNEL, around: "a" }),
		);
		expect(attach).toHaveBeenCalledWith([message("a", [fresh])]);
		expect(messages()[0]?.attachments[0]?.url).toBe(fresh);

		await expect(links.refresh(fresh)).resolves.toBe(false);
		expect(listMessages).toHaveBeenCalledTimes(1);
	});

	it("refreshes again once the refreshed link expires too", async () => {
		let clock = 150_000;
		const stale = signed("one", 100);
		const fresh = signed("one", 200);
		const newest = signed("one", 300);
		const { feed, messages } = feedOf([message("a", [stale])]);
		const listMessages = vi
			.fn<() => Promise<MessagePage>>()
			.mockImplementationOnce(async () => page([message("a", [fresh])]))
			.mockImplementation(async () => page([message("a", [newest])]));
		const links = createMediaLinkRefresher({
			feed: () => feed,
			listMessages,
			now: () => clock,
		});

		await expect(links.refresh(stale)).resolves.toBe(true);
		await expect(links.refresh(fresh)).resolves.toBe(false);
		clock = 250_000;
		await expect(links.refresh(fresh)).resolves.toBe(true);
		expect(messages()[0]?.attachments[0]?.url).toBe(newest);
		expect(listMessages).toHaveBeenCalledTimes(2);
		await expect(links.refresh(newest)).resolves.toBe(false);
	});

	it("does not refetch a link that already came back from a refresh and still fails", async () => {
		const link = signed("one", 100);
		const { feed } = feedOf([message("a", [link])]);
		const listMessages = vi.fn(async () => page([message("a", [link])]));
		const links = createMediaLinkRefresher({
			feed: () => feed,
			listMessages,
			now: () => 500_000,
		});
		await expect(links.refresh(link)).resolves.toBe(false);
		await expect(links.refresh(link)).resolves.toBe(false);
		expect(listMessages).toHaveBeenCalledTimes(1);
	});

	it("reports no change when the server returns the same link", async () => {
		const link = signed("one", 100);
		const { feed } = feedOf([message("a", [link])]);
		const listMessages = vi.fn(async () => page([message("a", [link])]));
		const links = createMediaLinkRefresher({ feed: () => feed, listMessages });
		await expect(links.refresh(link)).resolves.toBe(false);
	});

	it("shares one request between tiles of the same message", async () => {
		const first = signed("one", 100);
		const second = signed("two", 100);
		const { feed } = feedOf([message("a", [first, second])]);
		const listMessages = vi.fn(async () =>
			page([message("a", [signed("one", 200), signed("two", 200)])]),
		);
		const links = createMediaLinkRefresher({ feed: () => feed, listMessages });
		const results = await Promise.all([
			links.refresh(first),
			links.refresh(second),
		]);
		expect(results).toEqual([true, true]);
		expect(listMessages).toHaveBeenCalledTimes(1);
	});

	it("allows another refresh after a retry", async () => {
		const link = signed("one", 100);
		const { feed } = feedOf([message("a", [link])]);
		const listMessages = vi.fn(async () => page([message("a", [link])]));
		const links = createMediaLinkRefresher({ feed: () => feed, listMessages });
		await links.refresh(link);
		await links.refresh(link);
		expect(listMessages).toHaveBeenCalledTimes(1);
		links.retry(link);
		await links.refresh(link);
		expect(listMessages).toHaveBeenCalledTimes(2);
	});

	it("gives up quietly when the request fails or the message is gone", async () => {
		const link = signed("one", 100);
		const { feed, attach } = feedOf([message("a", [link])]);
		const listMessages = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		const links = createMediaLinkRefresher({ feed: () => feed, listMessages });
		await expect(links.refresh(link)).resolves.toBe(false);
		expect(attach).not.toHaveBeenCalled();
		await expect(links.refresh(signed("other", 1))).resolves.toBe(false);
		const none = createMediaLinkRefresher({
			feed: () => undefined,
			listMessages,
		});
		await expect(none.refresh(link)).resolves.toBe(false);
	});

	it("settles a stalled request after the timeout and allows a new one", async () => {
		vi.useFakeTimers();
		try {
			const link = signed("one", 100);
			const fresh = signed("one", 200);
			const { feed } = feedOf([message("a", [link])]);
			const listMessages = vi
				.fn<() => Promise<MessagePage>>()
				.mockImplementationOnce(() => new Promise(() => {}))
				.mockImplementation(async () => page([message("a", [fresh])]));
			const links = createMediaLinkRefresher({
				feed: () => feed,
				listMessages,
				timeoutMs: 1000,
			});
			const stalled = links.refresh(link);
			await vi.advanceTimersByTimeAsync(1000);
			await expect(stalled).resolves.toBe(false);
			links.retry(link);
			await expect(links.refresh(link)).resolves.toBe(true);
			expect(listMessages).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
