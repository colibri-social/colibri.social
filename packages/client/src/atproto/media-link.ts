export const MEDIA_REFRESH_LEAD_MS = 5 * 60 * 1000;

export const mediaLinkExpiry = (url: string): number | undefined => {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return undefined;
	}
	const raw = parsed.searchParams.get("exp");
	if (raw === null || raw.trim() === "") return undefined;
	const expiresAtSeconds = Number(raw);
	if (!Number.isFinite(expiresAtSeconds)) return undefined;
	return expiresAtSeconds * 1000;
};

export const isMediaLinkExpired = (url: string, nowMs: number): boolean => {
	const expiresAt = mediaLinkExpiry(url);
	return expiresAt !== undefined && expiresAt <= nowMs;
};

export const isMediaLinkExpiring = (url: string, nowMs: number): boolean =>
	isMediaLinkExpired(url, nowMs + MEDIA_REFRESH_LEAD_MS);

export const mediaRefreshDueAt = (
	urls: Iterable<string | undefined>,
): number | undefined => {
	let earliest: number | undefined;
	for (const url of urls) {
		if (!url) continue;
		const expiresAt = mediaLinkExpiry(url);
		if (expiresAt === undefined) continue;
		if (earliest === undefined || expiresAt < earliest) earliest = expiresAt;
	}
	return earliest === undefined ? undefined : earliest - MEDIA_REFRESH_LEAD_MS;
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
			!isMediaLinkExpiring(attachment.url, nowMs)
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
