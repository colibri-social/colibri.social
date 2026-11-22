const EXEMPT_EXACT = new Set([
	"/",
	"/tos",
	"/policy",
	"/imprint",
	"/3ds/qr",
	"/_image",
]);

const EXEMPT_PREFIXES = [
	"/.well-known/",
	"/c/",
	"/darwin/",
	"/linux/",
	"/windows/",
	"/beta/",
	"/og/",
	"/api/",
	"/_astro/",
];

const OAUTH_METADATA = /^\/oauth-client-metadata[^/]*\.json$/;

export const normalizePathname = (pathname: string) => {
	if (pathname.length > 1 && pathname.endsWith("/")) {
		return pathname.replace(/\/+$/, "") || "/";
	}

	return pathname;
};

export const isMaintenanceExempt = (pathname: string) => {
	const normalized = normalizePathname(pathname);

	return (
		EXEMPT_EXACT.has(normalized) ||
		OAUTH_METADATA.test(normalized) ||
		EXEMPT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
	);
};
