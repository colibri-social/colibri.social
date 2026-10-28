import { GITHUB_SPONSORS_TOKEN } from "astro:env/server";

const OPEN_COLLECTIVE_SLUG = "colibri-social";
const GITHUB_SPONSORS_LOGIN = "colibri-social";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const PARTIAL_CACHE_TTL_MS = 60 * 1000;

export const MONTHLY_GOAL_CENTS = 100_00;

export type Funding = {
	monthlyCents: number;
	contributors: number;
	goalCents: number;
};

type Source = { monthlyCents: number; contributors: number };

type OpenCollectiveResponse = {
	data?: {
		orders?: {
			nodes: Array<{ amount: { valueInCents: number } }>;
		};
	};
};

type GithubSponsorsResponse = {
	data?: {
		organization?: {
			sponsorshipsAsMaintainer?: {
				nodes: Array<{
					tier: { monthlyPriceInCents: number; isOneTime: boolean } | null;
				}>;
			};
		};
	};
};

let cached: { funding: Funding; fetchedAt: number; ttl: number } | null = null;

type GraphqlErrors = { errors?: Array<{ type?: string; message?: string }> };

const postGraphql = async <T>(
	source: string,
	url: string,
	query: string,
	headers: Record<string, string> = {},
): Promise<T | null> => {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"user-agent": "colibri.social-website",
				...headers,
			},
			body: JSON.stringify({ query }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) {
			console.warn(`[funding] ${source} responded with HTTP ${res.status}`);
			return null;
		}
		const json = (await res.json()) as T & GraphqlErrors;
		if (json.errors?.length) {
			const reasons = json.errors
				.map((e) => e.type ?? e.message ?? "unknown")
				.join(", ");
			console.warn(`[funding] ${source} returned errors: ${reasons}`);
		}
		return json;
	} catch (err) {
		console.warn(`[funding] ${source} request failed`, err);
		return null;
	}
};

const fetchOpenCollective = async (): Promise<Source | null> => {
	const json = await postGraphql<OpenCollectiveResponse>(
		"Open Collective",
		"https://api.opencollective.com/graphql/v2",
		`query {
			orders(account: { slug: "${OPEN_COLLECTIVE_SLUG}" }, filter: INCOMING, status: [ACTIVE], frequency: MONTHLY, limit: 1000) {
				nodes { amount { valueInCents } }
			}
		}`,
	);
	const nodes = json?.data?.orders?.nodes;
	if (!nodes) return null;
	return {
		monthlyCents: nodes.reduce((sum, n) => sum + n.amount.valueInCents, 0),
		contributors: nodes.length,
	};
};

const fetchGithubSponsors = async (): Promise<Source | null> => {
	if (!GITHUB_SPONSORS_TOKEN) {
		console.warn("[funding] GITHUB_SPONSORS_TOKEN is not set");
		return null;
	}
	const json = await postGraphql<GithubSponsorsResponse>(
		"GitHub Sponsors",
		"https://api.github.com/graphql",
		`query {
			organization(login: "${GITHUB_SPONSORS_LOGIN}") {
				sponsorshipsAsMaintainer(first: 100, activeOnly: true) {
					nodes { tier { monthlyPriceInCents isOneTime } }
				}
			}
		}`,
		{ authorization: `Bearer ${GITHUB_SPONSORS_TOKEN}` },
	);
	const nodes = json?.data?.organization?.sponsorshipsAsMaintainer?.nodes;
	if (!nodes) return null;
	const monthly = nodes.filter((n) => n.tier && !n.tier.isOneTime);
	return {
		monthlyCents: monthly.reduce(
			(sum, n) => sum + (n.tier?.monthlyPriceInCents ?? 0),
			0,
		),
		contributors: monthly.length,
	};
};

export const getFunding = async (): Promise<Funding | null> => {
	if (cached && Date.now() - cached.fetchedAt < cached.ttl) {
		return cached.funding;
	}

	const results = await Promise.all([
		fetchOpenCollective(),
		fetchGithubSponsors(),
	]);
	const sources = results.filter((s): s is Source => s !== null);

	const funding =
		sources.length === 0
			? null
			: {
					monthlyCents: sources.reduce((sum, s) => sum + s.monthlyCents, 0),
					contributors: sources.reduce((sum, s) => sum + s.contributors, 0),
					goalCents: MONTHLY_GOAL_CENTS,
				};

	if (funding) {
		const complete = sources.length === results.length;
		cached = {
			funding,
			fetchedAt: Date.now(),
			ttl: complete ? CACHE_TTL_MS : PARTIAL_CACHE_TTL_MS,
		};
	}
	return funding;
};
