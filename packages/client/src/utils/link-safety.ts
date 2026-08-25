import TLDs from "tlds";

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

export const isValidDomain = (str: string): boolean =>
	!!TLDs.find((tld) => {
		const i = str.lastIndexOf(tld);
		if (i === -1) return false;
		return str.charAt(i - 1) === "." && i === str.length - tld.length;
	});

const parse = (value: string): URL | null => {
	try {
		return new URL(value);
	} catch {
		return null;
	}
};

export const isSafeLinkUri = (uri: string): boolean => {
	const url = parse(uri);
	return !!url && SAFE_PROTOCOLS.has(url.protocol);
};

export const isWebUrl = (uri: string): boolean => {
	const url = parse(uri);
	return !!url && WEB_PROTOCOLS.has(url.protocol);
};

const bareHost = (host: string): string =>
	host.toLowerCase().replace(/^www\./, "");

export const labelHost = (label: string): string | null => {
	const trimmed = label.trim();
	if (trimmed.length === 0) return null;

	if (SCHEME_RE.test(trimmed)) return parse(trimmed)?.hostname ?? null;

	const authority = trimmed.split(/[/?#\s]/)[0];
	if (!authority.includes(".")) return null;
	if (!isValidDomain(authority.toLowerCase())) return null;

	return parse(`https://${trimmed}`)?.hostname ?? null;
};

const namesTargetPathSegment = (label: string, url: URL): boolean =>
	url.pathname.toLowerCase().split("/").includes(label.trim().toLowerCase());

export const isDisguisedLink = (label: string, uri: string): boolean => {
	const claimed = labelHost(label);
	if (claimed === null) return false;

	const target = parse(uri);
	if (!target) return true;
	if (bareHost(claimed) === bareHost(target.hostname)) return false;

	return !namesTargetPathSegment(label, target);
};

export const MARKDOWN_LINK_POLICY = {
	allowLink: (label: string, uri: string): boolean =>
		isSafeLinkUri(uri) && !isDisguisedLink(label, uri),
};

export const literalMarkdownLink = (label: string, uri: string): string =>
	`[${label}](${uri})`;
