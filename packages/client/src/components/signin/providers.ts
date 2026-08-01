export type Region = "eu" | "us";

export const FLAGS: Record<Region, string> = {
	eu: "/flags/eu.svg",
	us: "/flags/us.svg",
};

export const REGION_LABEL: Record<Region, string> = {
	eu: "EU",
	us: "US",
};

export type Provider = {
	id: string;
	name: string;
	logo: string;
	host: string;
	region: Region;
	badge?: { label: string; tone: "rec" | "pop" };
	desc: string;
};

export const PROVIDERS: Array<Provider> = [
	{
		id: "eurosky",
		name: "Eurosky",
		logo: "/login/eurosky.svg",
		host: "eurosky.social",
		region: "eu",
		badge: { label: "Recommended", tone: "rec" },
		desc: "A European initiative for sovereign social web infrastructure.",
	},
	{
		id: "bsky",
		name: "Bluesky",
		logo: "/login/bluesky.svg",
		host: "bsky.social",
		region: "us",
		badge: { label: "Most popular", tone: "pop" },
		desc: "The largest, most established provider on the network.",
	},
	{
		id: "blacksky",
		name: "Blacksky",
		logo: "/login/blacksky.svg",
		host: "blacksky.app",
		region: "us",
		desc: "Community-run, culture-first hosting.",
	},
	{
		id: "npmx",
		name: "NPMX",
		logo: "/login/npmx.svg",
		host: "npmx.social",
		region: "eu",
		desc: "The official AT Protocol Personal Data Server (PDS) for the npmx community.",
	},
];

export const REGIONS: Array<{
	value: "any" | Region;
	label: string;
	region?: Region;
}> = [
	{ value: "any", label: "All" },
	{ value: "eu", label: "EU", region: "eu" },
	{ value: "us", label: "US", region: "us" },
];

export const badgeBorder: Record<"rec" | "pop", string> = {
	rec: "border-primary",
	pop: "border-amber-400",
};

export const badgeBg: Record<"rec" | "pop", string> = {
	rec: "sm:bg-primary/25 bg-primary text-foreground",
	pop: "sm:bg-amber-400/25 bg-amber-400 sm:text-foreground text-background",
};

export const providerLogoForHost = (host: string): string | undefined =>
	PROVIDERS.find((provider) => provider.host === host)?.logo;

export const PROVIDER_DIRECTORY_URL = "https://atmosphereaccount.com/hosts";
export const SELF_HOSTING_URL = "https://atproto.com/guides/self-hosting";
