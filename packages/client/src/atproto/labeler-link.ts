import type { Agent } from "@atproto/api";
import { classifyResponse } from "../errors/classify";
import { isTauriRuntime } from "../notifications/environment";
import { getLabelerDid, getLabelerUrl } from "../utils/labeler";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import { invalidateExternalAccountLink } from "./labeler-attestation";
import { invalidateLabelerBadges } from "./labeler-lookup";

const log = createLogger("badges");

const LINK_METHOD = "social.colibri.labeler.linkExternalAccount";
const UNLINK_METHOD = "social.colibri.labeler.unlinkExternalAccount";

export const OPEN_COLLECTIVE_PLATFORM = "opencollective";

const TOKEN_LIFETIME_S = 60;
const REQUEST_TIMEOUT_MS = 15_000;

const serviceAuthToken = async (agent: Agent, lxm: string): Promise<string> => {
	const { data } = await agent.com.atproto.server.getServiceAuth({
		aud: `${getLabelerDid()}#atproto_labeler`,
		lxm,
		exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_S,
	});

	return data.token;
};

const callLabeler = async <T>(
	agent: Agent,
	method: string,
	input: Record<string, unknown>,
): Promise<T> => {
	const token = await serviceAuthToken(agent, method);

	const start = perfNow();
	const res = await fetch(`${getLabelerUrl()}/xrpc/${method}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(input),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	recordRequest(method, start, perfNow() - start, res.ok);

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw classifyResponse({
			status: res.status,
			body,
			method,
			retryAfter: res.headers.get("retry-after"),
		});
	}

	return (await res.json()) as T;
};

export const startExternalAccountLink = async (
	agent: Agent,
): Promise<string> => {
	const { authorizeUrl } = await callLabeler<{ authorizeUrl: string }>(
		agent,
		LINK_METHOD,
		{ platform: OPEN_COLLECTIVE_PLATFORM, native: isTauriRuntime() },
	);

	return authorizeUrl;
};

export interface UnlinkResult {
	unlinked: boolean;
	negatedLabelVals: Array<string>;
}

export const unlinkExternalAccount = async (
	agent: Agent,
	subject: string,
): Promise<UnlinkResult> => {
	const result = await callLabeler<{
		unlinked?: boolean;
		negatedLabelVals?: Array<string>;
	}>(agent, UNLINK_METHOD, { platform: OPEN_COLLECTIVE_PLATFORM });

	invalidateExternalAccountLink(subject);
	invalidateLabelerBadges(subject);

	return {
		unlinked: result.unlinked === true,
		negatedLabelVals: result.negatedLabelVals ?? [],
	};
};

export type LinkOutcome =
	| { status: "linked"; account?: string }
	| { status: "error"; reason: string };

export const readLinkOutcome = (
	params: URLSearchParams,
	subject: string,
): LinkOutcome | undefined => {
	const status = params.get("oc");
	if (status !== "linked" && status !== "error") return undefined;

	invalidateExternalAccountLink(subject);
	invalidateLabelerBadges(subject);

	if (status === "linked") {
		log.info("returned from a completed Open Collective link");
		return { status: "linked", account: params.get("account") ?? undefined };
	}

	const reason = params.get("reason") ?? "LinkFailed";
	log.warn("returned from a failed Open Collective link", { code: reason });
	return { status: "error", reason };
};

export const linkErrorMessage = (reason: string): string => {
	switch (reason) {
		case "GuestAccount":
			return "That Open Collective profile is still a guest profile. Claim it by signing in to Open Collective with the email you contributed with, then try again.";
		case "InvalidState":
		case "MissingState":
			return "That link attempt expired. Please start again.";
		case "MissingCode":
			return "Open Collective did not confirm the authorization. Please try again.";
		case "Unreachable":
			return "Open Collective could not be reached. Please try again shortly.";
		default:
			return "Linking your Open Collective account failed. Please try again.";
	}
};
