// Build-time replacement for `@sentry/solid/solidrouter` used when
// DISABLE_SENTRY is set
export function withSentryRouterRouting<T>(router: T): T {
	return router;
}

export function solidRouterBrowserTracingIntegration(): Record<string, never> {
	return {};
}
