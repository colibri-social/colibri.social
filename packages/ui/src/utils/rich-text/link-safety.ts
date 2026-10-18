import tlds from "tlds";

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
let knownTlds: Set<string> | undefined;

const punycodeLabel = (label: string) => {
	try {
		return new URL(`http://a.${label}`).hostname.split(".").pop();
	} catch {
		return undefined;
	}
};

const tldSet = () => {
	if (knownTlds) return knownTlds;
	const set = new Set<string>();
	for (const tld of tlds) {
		set.add(tld);
		const ascii = punycodeLabel(tld);
		if (ascii) set.add(ascii);
	}
	knownTlds = set;
	return set;
};

export const isValidDomain = (domain: string): boolean => {
	const dot = domain.lastIndexOf(".");
	if (dot <= 0 || dot === domain.length - 1) return false;
	return tldSet().has(domain.slice(dot + 1).toLowerCase());
};

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
