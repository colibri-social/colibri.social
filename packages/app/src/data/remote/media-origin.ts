let mainOrigin: string | null = null;
let nodeOrigin: string | null = null;

export const setMediaOrigins = (
	main: string | null,
	node: string | null,
): void => {
	mainOrigin = main ? new URL(main).origin : null;
	nodeOrigin = node ? new URL(node).origin : null;
};

export const mediaUrl = (url: string): string => {
	if (!mainOrigin || !nodeOrigin || mainOrigin === nodeOrigin) {
		return url;
	}

	try {
		const parsed = new URL(url);

		if (parsed.origin !== mainOrigin) {
			return url;
		}

		return `${nodeOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return url;
	}
};
