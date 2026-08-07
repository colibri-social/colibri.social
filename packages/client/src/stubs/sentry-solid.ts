// Build-time replacement for `@sentry/solid` used when DISABLE_SENTRY is set
import type { Component } from "solid-js";

export function init(): void {}

export function withSentryErrorBoundary<T extends Component<never>>(
	errorBoundary: T,
): T {
	return errorBoundary;
}

type StubScope = {
	setTag: (key: string, value: unknown) => StubScope;
	setUser: (user: { id: string } | null) => StubScope;
	setContext: (key: string, context: unknown) => StubScope;
	setExtra: (key: string, value: unknown) => StubScope;
	setLevel: (level: unknown) => StubScope;
};

const stubScope: StubScope = {
	setTag: () => stubScope,
	setUser: () => stubScope,
	setContext: () => stubScope,
	setExtra: () => stubScope,
	setLevel: () => stubScope,
};

export function addBreadcrumb(_breadcrumb: unknown): void {}

export function setUser(_user: { id: string } | null): void {}

export function captureException(_error: unknown): string {
	return "";
}

export function captureMessage(_message: string, _level?: unknown): string {
	return "";
}

export function captureFeedback(_params: unknown): string {
	return "";
}

export function lastEventId(): string | undefined {
	return undefined;
}

export function withScope<T>(callback: (scope: StubScope) => T): T {
	return callback(stubScope);
}

export function getClient(): undefined {
	return undefined;
}
