import { webAppOrigin } from "./web-origin";

export type LinkTarget = {
	kind: "external" | "internal";
	href: string;
	copyHref: string;
};

export type ClassifyLinkTargetInput = {
	href: string | null;
	isDownload: boolean;
	origin: string;
};

export const classifyLinkTarget = (
	input: ClassifyLinkTargetInput,
): LinkTarget | undefined => {
	if (!input.href || input.isDownload) return undefined;

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
};

export const resolveLinkTarget = (
	target: EventTarget | null,
): LinkTarget | undefined => {
	if (!(target instanceof Element)) return undefined;

	const anchor = target.closest("a[href]");
	if (!(anchor instanceof HTMLAnchorElement)) return undefined;

	return classifyLinkTarget({
		href: anchor.getAttribute("href"),
		isDownload: anchor.hasAttribute("download"),
		origin: webAppOrigin(),
	});
};
