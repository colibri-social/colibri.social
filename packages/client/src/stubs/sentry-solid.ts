// Build-time replacement for `@sentry/solid` used when DISABLE_SENTRY is set
import type { Component } from "solid-js";

export function init(): void {}

export function withSentryErrorBoundary<T extends Component<never>>(
	errorBoundary: T,
): T {
	return errorBoundary;
}
