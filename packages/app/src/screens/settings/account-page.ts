import { type Accessor, createSignal } from "solid-js";
import type { DataStore } from "../../data/store";

const BLUESKY_ACCOUNT_SETTINGS = "https://bsky.app/settings/account";

const isBlueskyHost = (host: string) =>
	host === "bsky.social" ||
	host === "bsky.network" ||
	host.endsWith(".host.bsky.network");

export const accountPageUrl = (host: string) =>
	isBlueskyHost(host)
		? BLUESKY_ACCOUNT_SETTINGS
		: new URL("/account", `https://${host}`).href;

const pages = new Map<string, Accessor<string | undefined>>();

export const accountPageOf = (data: DataStore): string | undefined => {
	const did = data.viewer.did;
	let page = pages.get(did);
	if (!page) {
		const [url, setUrl] = createSignal<string>();
		void data.source
			.accountHost()
			.then((host) => {
				if (host) setUrl(accountPageUrl(host));
			})
			.catch(() => undefined);
		pages.set(did, url);
		page = url;
	}
	return page();
};
