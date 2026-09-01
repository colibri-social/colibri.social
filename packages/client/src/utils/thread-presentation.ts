const THREAD_SUFFIX = /\/t\/[^/]+$/;

export const channelPathOf = (pathname: string): string =>
	pathname.replace(THREAD_SUFFIX, "");

export const isThreadPath = (pathname: string): boolean =>
	THREAD_SUFFIX.test(pathname);

export type ThreadPresentation = "split" | "full";

export const invertPresentation = (
	mode: ThreadPresentation,
): ThreadPresentation => (mode === "split" ? "full" : "split");

export const presentationFromSearch = (
	split: string | Array<string> | undefined,
	isMobile: boolean,
): ThreadPresentation => (!isMobile && split === "1" ? "split" : "full");

export const threadHref = (path: string, mode: ThreadPresentation): string =>
	mode === "split" ? `${path}?split=1` : path;
