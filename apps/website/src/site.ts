export const SITE = "https://spaces.colibri.social";

const NOINDEX_HOSTS = new Set(["spaces.colibri.social"]);

export const NOINDEX = NOINDEX_HOSTS.has(new URL(SITE).hostname);
