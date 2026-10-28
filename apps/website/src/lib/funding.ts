import { GITHUB_SPONSORS_TOKEN } from "astro:env/server";

const OPEN_COLLECTIVE_SLUG = "colibri-social";
const GITHUB_SPONSORS_LOGIN = "colibri-social";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;

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

let cached: { funding: Funding; fetchedAt: number } | null = null;

const postGraphql = async <T>(
	url: string,
	query: string,
	headers: Record<string, string> = {},
): Promise<T | null> => {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify({ query }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
};

const fetchOpenCollective = async (): Promise<Source | null> => {
	const json = await postGraphql<OpenCollectiveResponse>(
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
	if (!GITHUB_SPONSORS_TOKEN) return null;
	const json = await postGraphql<GithubSponsorsResponse>(
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
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.funding;
	}

	const sources = (
		await Promise.all([fetchOpenCollective(), fetchGithubSponsors()])
	).filter((s): s is Source => s !== null);

	const funding =
		sources.length === 0
			? null
			: {
					monthlyCents: sources.reduce((sum, s) => sum + s.monthlyCents, 0),
					contributors: sources.reduce((sum, s) => sum + s.contributors, 0),
					goalCents: MONTHLY_GOAL_CENTS,
				};

	if (funding) cached = { funding, fetchedAt: Date.now() };
	return funding;
};
