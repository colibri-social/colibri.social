/**
 * Watches `element` for size changes (e.g. an image, video, or embed finishing
 * its async load) and keeps the viewport visually stable.
 *
 * Two cases, re-evaluated on every resize so that multi-stage growth (an embed
 * card appearing, then its image loading) and multiple growable elements per
 * message are each handled:
 *
 * - **Pinned to the bottom** (`isAtBottom()`): the user is tracking the newest
 *   messages, so we re-pin to the bottom — newly-loaded media stays in view
 *   instead of pushing the latest content off-screen. This is the case the old
 *   implementation missed (the layout's own re-pin observer is inert because the
 *   messages wrapper has a fixed height).
 * - **Scrolled up**: only growth that happens above the viewport top would shift
 *   what the user is looking at, so we add the height delta to `scrollTop` to
 *   cancel it. Growth at or below the fold is left alone.
 *
 * @param getContainer Resolves the scrollable container lazily, since its ref
 *   may not be assigned yet when this is wired up.
 * @param element The media element whose growth should not shift the viewport.
 * @param isAtBottom Reports whether the container was pinned to the bottom prior
 *   to this resize (tracked by the ScrollAnchorProvider via scroll events).
 * @returns A cleanup function that disconnects the observer.
 */
export const preserveScrollOnResize = (
	getContainer: () => HTMLElement | undefined,
	element: HTMLElement,
	isAtBottom: () => boolean,
): (() => void) => {
	// `null` until the first observation establishes a baseline; we only react
	// to subsequent changes so the initial layout pass isn't treated as growth.
	let previousHeight: number | null = null;

	const observer = new ResizeObserver(() => {
		const height = element.offsetHeight;

		if (previousHeight === null) {
			previousHeight = height;
			// The element just mounted with its initial size (e.g. a media player
			// that has a fixed/reserved height and won't grow further). If we were
			// pinned to the bottom, re-pin so the new content stays in view — the
			// growth branch below only fires on *subsequent* resizes.
			if (isAtBottom()) {
				const container = getContainer();
				if (container) container.scrollTop = container.scrollHeight;
			}
			return;
		}

		const delta = height - previousHeight;
		previousHeight = height;
		if (delta === 0) return;

		const container = getContainer();
		if (!container) return;

		if (isAtBottom()) {
			container.scrollTop = container.scrollHeight;
			return;
		}

		if (
			element.getBoundingClientRect().top <
			container.getBoundingClientRect().top
		) {
			container.scrollTop += delta;
		}
	});

	observer.observe(element);

	return () => observer.disconnect();
};
