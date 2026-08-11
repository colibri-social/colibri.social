export const SCOPE_REAUTH_FLAG = "colibri:scope-reauth";

export const MAX_SCOPE_REAUTH_ATTEMPTS = 2;

export const scopeReauthAttempts = (): number => {
	try {
		const raw = sessionStorage.getItem(SCOPE_REAUTH_FLAG);
		if (raw === null) return 0;
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
	} catch {
		return 0;
	}
};

export const noteScopeReauthAttempt = (): void => {
	try {
		sessionStorage.setItem(
			SCOPE_REAUTH_FLAG,
			String(scopeReauthAttempts() + 1),
		);
	} catch {}
};

export const clearScopeReauthAttempts = (): void => {
	try {
		sessionStorage.removeItem(SCOPE_REAUTH_FLAG);
	} catch {}
};

export const scopeReauthExhausted = (): boolean =>
	scopeReauthAttempts() >= MAX_SCOPE_REAUTH_ATTEMPTS;
