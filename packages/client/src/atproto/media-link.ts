export const isMediaLinkExpired = (url: string, nowMs: number): boolean => {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	const raw = parsed.searchParams.get("exp");
	if (raw === null || raw.trim() === "") return false;
	const expiresAtSeconds = Number(raw);
	if (!Number.isFinite(expiresAtSeconds)) return false;
	return expiresAtSeconds * 1000 <= nowMs;
};

const SIGNATURE_PARAMS = ["exp", "sig"];

export const mediaLinkTarget = (url: string): string => {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	for (const param of SIGNATURE_PARAMS) parsed.searchParams.delete(param);
	return parsed.toString();
};

export const canKeepMediaLinks = (
	local: ReadonlyArray<{ url: string }>,
	fresh: ReadonlyArray<{ url: string }>,
	nowMs: number,
): boolean =>
	local.length === fresh.length &&
	local.every((attachment, index) => {
		const counterpart = fresh[index];
		return (
			counterpart !== undefined &&
			mediaLinkTarget(attachment.url) === mediaLinkTarget(counterpart.url) &&
			!isMediaLinkExpired(attachment.url, nowMs)
		);
	});

export const liveMediaLink = (
	candidates: ReadonlyArray<{ url: string }>,
	url: string,
	nowMs: number,
): string | undefined => {
	const target = mediaLinkTarget(url);
	const match = candidates.find(
		(candidate) => mediaLinkTarget(candidate.url) === target,
	);
	if (!match || isMediaLinkExpired(match.url, nowMs)) return undefined;
	return match.url;
};
