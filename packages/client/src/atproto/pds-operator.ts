import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";

const log = createLogger("pds-operator");

const BLUESKY_ACCOUNT_SETTINGS = "https://bsky.app/settings/account";

export type PdsOperator = {
	host: string;
	deletionUrl?: string;
	deletionLinkLabel?: string;
	contactEmail?: string;
	privacyPolicyUrl?: string;
	termsUrl?: string;
};

type DescribeServerResponse = {
	contact?: { email?: unknown };
	links?: { privacyPolicy?: unknown; termsOfService?: unknown };
};

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

export const isBlueskyHost = (host: string): boolean =>
	host === "bsky.social" ||
	host === "bsky.network" ||
	host.endsWith(".host.bsky.network");

export const parseDescribeServer = (
	host: string,
	body: unknown,
	accountPage?: string,
): PdsOperator => {
	const operator: PdsOperator = { host };

	if (accountPage) {
		operator.deletionUrl = accountPage;
		operator.deletionLinkLabel = `your account page on ${host}`;
	} else if (isBlueskyHost(host)) {
		operator.deletionUrl = BLUESKY_ACCOUNT_SETTINGS;
		operator.deletionLinkLabel = "your Bluesky account settings";
	}

	if (typeof body !== "object" || body === null) return operator;

	const described = body as DescribeServerResponse;
	operator.contactEmail = asString(described.contact?.email);
	operator.privacyPolicyUrl = asString(described.links?.privacyPolicy);
	operator.termsUrl = asString(described.links?.termsOfService);

	return operator;
};

export const describePdsOperator = async (
	pdsHost: string,
	accountPage?: string,
): Promise<PdsOperator> => {
	const host = pdsHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");

	try {
		const res = await fetch(
			`https://${host}/xrpc/com.atproto.server.describeServer`,
		);
		if (!res.ok) {
			log.warn("describeServer returned a non-ok status", {
				status: res.status,
			});
			return parseDescribeServer(host, undefined, accountPage);
		}
		return parseDescribeServer(host, await res.json(), accountPage);
	} catch (err) {
		const error = classifyThrown(err, {
			method: "com.atproto.server.describeServer",
		});
		log.warn("could not describe the pds", { code: error.code });
		return parseDescribeServer(host, undefined, accountPage);
	}
};
