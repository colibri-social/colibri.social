import * as Sentry from "@sentry/solid";
import { solidRouterBrowserTracingIntegration } from "@sentry/solid/solidrouter";

Sentry.init({
	dsn: "https://df35547ef99d80129488681e91b90774@o4511127838916608.ingest.de.sentry.io/4511671478976592",
	enabled: !import.meta.env.DEV,
	environment: import.meta.env.DEV ? "development" : "production",
	sendDefaultPii: true,
	integrations: [solidRouterBrowserTracingIntegration()],
	tracesSampleRate: 1,
	tracePropagationTargets: [
		"localhost",
		/^https:\/\/colibri\.social\/_actions/,
		/^https:\/\/colibri\.social\/api/,
		/^https:\/\/api\.colibri\.social/,
	],
	enableLogs: true,
});
