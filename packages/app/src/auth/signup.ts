const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
const AUTHORIZATION_SERVER_PATH = "/.well-known/oauth-authorization-server";
const METADATA_TIMEOUT_MS = 8_000;

export const parseSignupPdsUrl = (raw: unknown): string | undefined => {
	if (typeof raw !== "string" || !raw.trim()) return undefined;
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
};

export const signupPdsUrl = (): string | undefined =>
	parseSignupPdsUrl(import.meta.env.VITE_COLIBRI_SIGNUP_PDS_URL);

export const signupHostLabel = (pdsUrl: string): string => new URL(pdsUrl).host;

const readJson = async (
	fetchImpl: typeof fetch,
	url: URL,
	signal: AbortSignal,
): Promise<Record<string, unknown>> => {
	const response = await fetchImpl(url.href, {
		headers: { accept: "application/json" },
		signal,
	});
	if (!response.ok)
		throw new Error(`metadata request failed: ${response.status}`);
	const body: unknown = await response.json();
	if (typeof body !== "object" || body === null)
		throw new Error("bad metadata");
	return body as Record<string, unknown>;
};

const authorizationServerOf = (
	resource: Record<string, unknown>,
	pdsUrl: string,
): string => {
	const servers = resource.authorization_servers;
	if (Array.isArray(servers) && typeof servers[0] === "string") {
		return servers[0];
	}
	return pdsUrl;
};

export const supportsSignup = async (
	pdsUrl: string,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
	const signal = AbortSignal.timeout(METADATA_TIMEOUT_MS);
	try {
		const resource = await readJson(
			fetchImpl,
			new URL(PROTECTED_RESOURCE_PATH, pdsUrl),
			signal,
		);
		const server = authorizationServerOf(resource, pdsUrl);
		const metadata = await readJson(
			fetchImpl,
			new URL(AUTHORIZATION_SERVER_PATH, server),
			signal,
		);
		const prompts = metadata.prompt_values_supported;
		return Array.isArray(prompts) && prompts.includes("create");
	} catch {
		return false;
	}
};
