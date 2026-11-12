import { type Accessor, createSignal } from "solid-js";
import type { DataStore } from "../../data/store";

export const accountPageUrl = (issuer: string) => {
	return new URL("/account", issuer).href;
};

const pages = new Map<string, Accessor<string | undefined>>();

export const accountPageOf = (data: DataStore): string | undefined => {
	const did = data.viewer.did;
	let page = pages.get(did);
	if (!page) {
		const [url, setUrl] = createSignal<string>();
		void data.source
			.accountIssuer()
			.then((issuer) => {
				if (issuer) setUrl(accountPageUrl(issuer));
			})
			.catch(() => undefined);
		pages.set(did, url);
		page = url;
	}
	return page();
};
