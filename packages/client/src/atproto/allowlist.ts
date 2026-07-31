export const ALLOWLIST_ENABLED = false;

export const ALLOWED_DIDS = new Set<string>([]);

export const isAllowedDid = (did: string | undefined | null): boolean =>
	!ALLOWLIST_ENABLED || (did != null && ALLOWED_DIDS.has(did));
