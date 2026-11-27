import {
	APPVIEW_FRAGMENT,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import type { ServerCheck } from "@colibri-social/ui";

const log = createLogger("server-check");

const CHECK_TIMEOUT_MS = 8000;

const DESCRIBE_PATH = "/xrpc/social.colibri.beta.server.describeServer";

type DidService = { id?: unknown; type?: unknown; serviceEndpoint?: unknown };

const fetchJson = async (url: string): Promise<unknown> => {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
	});

	if (!res.ok) return undefined;

	return res.json().catch(() => undefined);
};

const hasAppViewService = (doc: unknown): boolean => {
	if (typeof doc !== "object" || doc === null) return false;

	const services = (doc as { service?: unknown }).service;

	if (!Array.isArray(services)) return false;

	return services.some((service: DidService) => {
		return (
			typeof service.id === "string" &&
			service.id.endsWith(`#${APPVIEW_FRAGMENT}`) &&
			typeof service.serviceEndpoint === "string"
		);
	});
};

const featuresOf = (description: unknown): string[] => {
	if (typeof description !== "object" || description === null) return [];

	const features = (description as { features?: unknown }).features;

	return Array.isArray(features)
		? features.filter((feature) => typeof feature === "string")
		: [];
};

export const checkServer = async (url: string): Promise<ServerCheck> => {
	let doc: unknown;
	let description: unknown;

	try {
		[doc, description] = await Promise.all([
			fetchJson(`${url}/.well-known/did.json`),
			fetchJson(`${url}${DESCRIBE_PATH}`),
		]);
	} catch (err) {
		log.warn("server check failed", { code: classifyThrown(err).code });

		return { status: "unreachable" };
	}

	if (!hasAppViewService(doc) || description === undefined) {
		return { status: "notColibri" };
	}

	const features = featuresOf(description);

	return {
		status: "ok",
		url,
		host: new URL(url).host,
		features: {
			calls: features.includes("voice"),
			otherServers: features.includes("federation"),
		},
	};
};
