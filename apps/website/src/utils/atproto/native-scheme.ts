export const nativeRedirectScheme = (): string =>
	new URL(import.meta.env.SITE).hostname.split(".").reverse().join(".");

export const nativeRedirectUri = (): string =>
	`${nativeRedirectScheme()}:/oauth/callback`;
