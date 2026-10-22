import { describe, expect, it, vi } from "vitest";
import type { MediaLinkRefresher } from "../../data/media-link";
import type { MessageView } from "../../data/types";
import { createAnchorLinkRefresher } from "./anchor-links";

const BLOB =
	"https://appview.test/xrpc/social.colibri.beta.blob.get?did=did%3Aplc%3Aa&cid=bafy";

const withLink = (exp: number) =>
	({
		attachments: [{ url: `${BLOB}&exp=${exp}&sig=s${exp}` }],
	}) as unknown as MessageView;

describe("createAnchorLinkRefresher", () => {
	it("reloads a stored anchor and reports the fresh link", async () => {
		let current = withLink(1);
		const reload = vi.fn(async () => {
			current = withLink(2);
		});
		const links = createAnchorLinkRefresher({
			live: () => undefined,
			reload,
			current: () => current,
		});

		await expect(links.refresh(`${BLOB}&exp=1&sig=s1`)).resolves.toBe(true);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("tries a failing link only once until retried", async () => {
		const reload = vi.fn(async () => {});
		const current = withLink(1);
		const links = createAnchorLinkRefresher({
			live: () => undefined,
			reload,
			current: () => current,
		});
		const url = `${BLOB}&exp=1&sig=s1`;

		await expect(links.refresh(url)).resolves.toBe(false);
		await expect(links.refresh(url)).resolves.toBe(false);
		expect(reload).toHaveBeenCalledTimes(1);
		links.retry(url);
		await links.refresh(url);
		expect(reload).toHaveBeenCalledTimes(2);
	});

	it("hands a live anchor to the channel refresher", async () => {
		const live: MediaLinkRefresher = {
			refresh: vi.fn(async () => true),
			retry: vi.fn(),
		};
		const reload = vi.fn(async () => {});
		const links = createAnchorLinkRefresher({
			live: () => live,
			reload,
			current: () => undefined,
		});

		await expect(links.refresh(BLOB)).resolves.toBe(true);
		expect(live.refresh).toHaveBeenCalledWith(BLOB);
		expect(reload).not.toHaveBeenCalled();
	});

	it("reports no fresh link when the reload fails", async () => {
		const links = createAnchorLinkRefresher({
			live: () => undefined,
			reload: async () => {
				throw new Error("offline");
			},
			current: () => withLink(1),
		});

		await expect(links.refresh(`${BLOB}&exp=1&sig=s1`)).resolves.toBe(false);
	});
});
