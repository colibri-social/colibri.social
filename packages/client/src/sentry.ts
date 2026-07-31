import * as Sentry from "@sentry/solid";
import { solidRouterBrowserTracingIntegration } from "@sentry/solid/solidrouter";
import { redactText } from "./utils/redact";

export interface InitSentryOptions {
	dsn?: string;
	environment?: string;
	enabled?: boolean;
	release?: string;
	dist?: string;
	tracesSampleRate?: number;
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

const IGNORED_MESSAGES = [
	"ResizeObserver loop",
	"Non-Error promise rejection captured",
	"The play() request was interrupted",
	"AbortError: The operation was aborted",
];

const NOISY_BREADCRUMB_CATEGORIES = ["voice/debug", "ui.click"];

const scrubEvent = <T extends { message?: unknown; breadcrumbs?: unknown }>(
	event: T,
): T => {
	if (typeof event.message === "string") {
		event.message = redactText(event.message);
	}
	if (Array.isArray(event.breadcrumbs)) {
		for (const crumb of event.breadcrumbs) {
			if (crumb && typeof crumb === "object") {
				const record = crumb as { message?: unknown };
				if (typeof record.message === "string") {
					record.message = redactText(record.message);
				}
			}
		}
	}
	return event;
};

export function identifyUser(did: string | undefined): void {
	Sentry.setUser(did ? { id: did } : null);
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
		tracesSampleRate: options.tracesSampleRate ?? 0.2,
		tracePropagationTargets: [
			"localhost",
			/^https:\/\/colibri\.social\/_actions/,
			/^https:\/\/colibri\.social\/api/,
			/^https:\/\/api\.colibri\.social/,
			/^https:\/\/appview\.colibri\.social/,
		],
		ignoreErrors: IGNORED_MESSAGES,
		beforeBreadcrumb: (breadcrumb) => {
			if (
				breadcrumb.category &&
				NOISY_BREADCRUMB_CATEGORIES.includes(breadcrumb.category)
			) {
				return null;
			}
			if (typeof breadcrumb.message === "string") {
				breadcrumb.message = redactText(breadcrumb.message);
			}
			return breadcrumb;
		},
		beforeSend: (event) => scrubEvent(event),
	});
}
