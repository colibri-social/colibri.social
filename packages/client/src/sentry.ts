import * as Sentry from "@sentry/solid";
import { solidRouterBrowserTracingIntegration } from "@sentry/solid/solidrouter";

export interface InitSentryOptions {
	dsn?: string;
	environment?: string;
	enabled?: boolean;
	release?: string;
	dist?: string;
}

type GlobalHandlerKey = "onerror" | "onunhandledrejection";

function dropUnreachableHandler(key: GlobalHandlerKey): void {
	if (typeof window === "undefined") return;

	const target = window as unknown as Record<GlobalHandlerKey, unknown>;
	let callable: boolean;

	try {
		const existing = target[key];
		if (existing == null) return;
		callable = typeof (existing as { apply?: unknown }).apply === "function";
	} catch {
		callable = false;
	}

	if (callable) return;

	try {
		target[key] = null;
	} catch {}
}

export function initSentry(options: InitSentryOptions): void {
	if (!options.dsn) return;

	dropUnreachableHandler("onerror");
	dropUnreachableHandler("onunhandledrejection");

	Sentry.init({
		dsn: options.dsn,
		enabled: options.enabled ?? true,
		environment: options.environment ?? "production",
		release: options.release,
		dist: options.dist,
		sendDefaultPii: false,
		integrations: [solidRouterBrowserTracingIntegration()],
		tracesSampleRate: 1,
		tracePropagationTargets: [
			"localhost",
			/^https:\/\/colibri\.social\/_actions/,
			/^https:\/\/colibri\.social\/api/,
			/^https:\/\/api\.colibri\.social/,
			/^https:\/\/appview\.colibri\.social/,
		],
		enableLogs: true,
	});
}
