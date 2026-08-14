import { webAppOrigin } from "./web-origin";

export type LinkTarget =
	| { kind: "external" | "internal"; href: string; copyHref: string }
	| { kind: "did"; did: string };

export type ClassifyLinkTargetInput = {
	href: string | null;
	did: string | null;
	isDownload: boolean;
	origin: string;
};

const LINK_TARGET_SELECTOR = "a[href], [data-facet-type='mention'][data-did]";

export const classifyLinkTarget = (
	input: ClassifyLinkTargetInput,
): LinkTarget | undefined => {
	if (input.href && !input.isDownload) {
		const href = input.href.trim();
		if (href.length === 0 || href.startsWith("#")) return undefined;

		if (/^https?:\/\//i.test(href)) {
			return { kind: "external", href, copyHref: href };
		}

		if (href.startsWith("/")) {
			return {
				kind: "internal",
				href,
				copyHref: `${input.origin.replace(/\/$/, "")}${href}`,
			};
		}

		return undefined;
	}

	if (input.did) return { kind: "did", did: input.did };

	return undefined;
};

export const resolveLinkTarget = (
	target: EventTarget | null,
): LinkTarget | undefined => {
	if (!(target instanceof Element)) return undefined;

	const el = target.closest(LINK_TARGET_SELECTOR);
	if (!el) return undefined;

	const anchor = el instanceof HTMLAnchorElement ? el : null;

	return classifyLinkTarget({
		href: anchor ? anchor.getAttribute("href") : null,
		did: el.getAttribute("data-did"),
		isDownload: anchor ? anchor.hasAttribute("download") : false,
		origin: webAppOrigin(),
	});
};
