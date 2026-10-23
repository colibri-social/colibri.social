const normalizeServer = (value: string) =>
	value
		.trim()
		.replace(/^https?:\/\//i, "")
		.replace(/\/.*$/, "")
		.toLowerCase();

export const checkSpacesSupport = async (
	server: string,
	fetcher: typeof fetch = fetch,
): Promise<boolean> => {
	const base = `https://${normalizeServer(server)}`;
	const described = await fetcher(
		`${base}/xrpc/com.atproto.server.describeServer`,
	).catch(() => null);
	if (!described?.ok) return false;
	const probe = await fetcher(
		`${base}/xrpc/com.atproto.simplespace.getSpace`,
	).catch(() => null);
	if (!probe) return false;
	if (probe.status === 404 || probe.status === 501) return false;
	const body = (await probe.json().catch(() => ({}))) as { error?: string };
	return body.error !== "MethodNotImplemented";
};
