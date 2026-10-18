import {
	LinkWarning,
	linkWarningHost,
	type RichTextExternalLink,
} from "@colibri-social/ui";
import { createRoot, createSignal } from "solid-js";
import { useData } from "../../../data/store";
import { openAppLink } from "../../../native/deep-links";
import { openExternalUrl } from "../../../native/open-external";
import { usePlatform } from "../../../screen/platform";

const DEFAULT_TRUSTED = ["colibri.social", "next.colibri.social", "bsky.app"];

const trustedHosts = createRoot(() => {
	const [hosts, setHosts] = createSignal<ReadonlySet<string>>(
		new Set([
			...DEFAULT_TRUSTED,
			...(typeof location === "undefined" ? [] : [location.hostname]),
		]),
	);
	return {
		has: (host: string) => hosts().has(host.toLowerCase()),
		add: (host: string) =>
			setHosts((current) => new Set([...current, host.toLowerCase()])),
	};
});

export const isTrustedHost = (host: string) => trustedHosts.has(host);

export const trustHost = (host: string) => trustedHosts.add(host);

export const createLinkOpener = () => {
	const platform = usePlatform();
	const data = useData();
	const [pending, setPending] = createSignal<{
		url: string;
		disguised: boolean;
	}>();
	const [open, setOpen] = createSignal(false);

	const onExternalLink = (url: string, link: RichTextExternalLink) => {
		if (!link.disguised && openAppLink(url)) return;
		const host = linkWarningHost(url);
		if (!host) return;
		const warn = data.preferences.client().warnOnExternalLinks;
		if (!link.disguised && (!warn || isTrustedHost(host))) {
			openExternalUrl(url);
			return;
		}
		setPending({ url, disguised: link.disguised });
		setOpen(true);
	};

	const LinkWarningOutlet = () => (
		<LinkWarning
			open={open()}
			onOpenChange={setOpen}
			url={pending()?.url ?? ""}
			disguised={pending()?.disguised}
			platform={platform()}
			onConfirm={({ trustHost: trust }) => {
				const current = pending();
				if (!current) return;
				if (trust) trustHost(linkWarningHost(current.url));
				openExternalUrl(current.url);
			}}
		/>
	);

	return { onExternalLink, LinkWarningOutlet };
};
