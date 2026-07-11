import * as Sentry from "@sentry/solid";
import { solidRouterBrowserTracingIntegration } from "@sentry/solid/solidrouter";

export interface InitSentryOptions {
	dsn?: string;
	environment?: string;
	enabled?: boolean;
	release?: string;
	dist?: string;
}

export function initSentry(options: InitSentryOptions): void {
	if (!options.dsn) return;

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
