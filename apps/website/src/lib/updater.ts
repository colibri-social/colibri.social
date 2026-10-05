import { GITHUB_TOKEN } from "astro:env/server";
import type { APIRoute } from "astro";

const REPO = "colibri-social/colibri.social";
const CACHE_TTL_MS = 15 * 60 * 1000;

type ManifestPlatform = {
	signature: string;
	url: string;
};

type Manifest = {
	version: string;
	notes?: string;
	pub_date?: string;
	platforms: Record<string, ManifestPlatform>;
};

type GithubRelease = {
	draft: boolean;
	tag_name: string;
	html_url: string;
	assets: Array<{ name: string; browser_download_url: string }>;
};

export type UpdateChannel = "stable" | "spaces";

const SPACES_TAG = /-spaces\./;

const releaseChannel = (release: GithubRelease): UpdateChannel =>
	SPACES_TAG.test(release.tag_name) ? "spaces" : "stable";

const cache = new Map<
	UpdateChannel,
	{ manifest: Manifest; fetchedAt: number }
>();

let releasesCache: { releases: GithubRelease[]; fetchedAt: number } | null =
	null;

const githubHeaders = (): HeadersInit => {
	const headers: Record<string, string> = {
		accept: "application/vnd.github+json",
	};
	if (GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;
	return headers;
};

const fetchReleases = async (): Promise<GithubRelease[] | null> => {
	if (releasesCache && Date.now() - releasesCache.fetchedAt < CACHE_TTL_MS) {
		return releasesCache.releases;
	}

	const res = await fetch(
		`https://api.github.com/repos/${REPO}/releases?per_page=30`,
		{ headers: githubHeaders() },
	);
	if (!res.ok) return null;

	const releases = (await res.json()) as GithubRelease[];
	releasesCache = { releases, fetchedAt: Date.now() };
	return releases;
};

const findLatestRelease = async (
	channel: UpdateChannel,
): Promise<GithubRelease | undefined> => {
	const releases = await fetchReleases();
	return releases?.find((r) => !r.draft && releaseChannel(r) === channel);
};

export const latestSpacesRelease = async (): Promise<{
	version: string;
	url: string;
} | null> => {
	try {
		const release = await findLatestRelease("spaces");
		if (!release) return null;
		return {
			version: release.tag_name.replace(/^v/, ""),
			url: release.html_url,
		};
	} catch {
		return null;
	}
};

const fetchLatestManifest = async (
	channel: UpdateChannel,
): Promise<Manifest | null> => {
	const cached = cache.get(channel);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.manifest;
	}

	const release = await findLatestRelease(channel);
	const asset = release?.assets.find((a) => a.name === "latest.json");
	if (!asset) return null;

	const manifestRes = await fetch(asset.browser_download_url, {
		headers: githubHeaders(),
	});
	if (!manifestRes.ok) return null;

	const manifest = (await manifestRes.json()) as Manifest;
	cache.set(channel, { manifest, fetchedAt: Date.now() });
	return manifest;
};

const parseVersion = (version: string) => {
	const [core, ...preParts] = version.split("-");
	const [major = 0, minor = 0, patch = 0] = core.split(".").map(Number);
	return { major, minor, patch, prerelease: preParts.join("-") };
};

const comparePrerelease = (a: string, b: string): number => {
	const as = a.split(".");
	const bs = b.split(".");
	for (let i = 0; i < Math.max(as.length, bs.length); i++) {
		const av = as[i];
		const bv = bs[i];
		if (av === bv) continue;
		if (av === undefined) return -1;
		if (bv === undefined) return 1;
		const an = Number(av);
		const bn = Number(bv);
		if (!Number.isNaN(an) && !Number.isNaN(bn)) {
			if (an !== bn) return an - bn;
			continue;
		}
		if (av !== bv) return av < bv ? -1 : 1;
	}
	return 0;
};

const isNewer = (candidate: string, current: string): boolean => {
	const a = parseVersion(candidate);
	const b = parseVersion(current);
	if (a.major !== b.major) return a.major > b.major;
	if (a.minor !== b.minor) return a.minor > b.minor;
	if (a.patch !== b.patch) return a.patch > b.patch;
	if (!a.prerelease && !b.prerelease) return false;
	if (!a.prerelease) return true;
	if (!b.prerelease) return false;
	return comparePrerelease(a.prerelease, b.prerelease) > 0;
};

export const updaterRoute =
	(channel: UpdateChannel): APIRoute =>
	async ({ params }) => {
		const { target, arch, version } = params;
		if (!target || !arch || !version) {
			return new Response(null, { status: 400 });
		}

		const manifest = await fetchLatestManifest(channel);
		if (!manifest) return new Response(null, { status: 204 });

		const platform = manifest.platforms[`${target}-${arch}`];
		if (!platform) return new Response(null, { status: 404 });

		if (!isNewer(manifest.version, version)) {
			return new Response(null, { status: 204 });
		}

		return new Response(
			JSON.stringify({
				version: manifest.version,
				notes: manifest.notes ?? "",
				pub_date: manifest.pub_date,
				url: platform.url,
				signature: platform.signature,
			}),
			{
				status: 200,
				headers: { "content-type": "application/json" },
			},
		);
	};
