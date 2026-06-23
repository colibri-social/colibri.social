/**
 * Watches `element` for size changes (e.g. an image, video, or embed finishing
 * its async load) and compensates the scroll position of `getContainer()` so
 * the viewport stays visually stable.
 *
 * Without this, media that loads in above the current viewport pushes every
 * following message down, making the whole channel appear to jump. The fix is
 * pure scroll math — no reserved dimensions or schema changes required — which
 * keeps the logic reusable for any growable content (attachments today, link
 * embeds next).
 *
 * @param getContainer Resolves the scrollable container lazily, since its ref
 *   may not be assigned yet when this is wired up.
 * @param element The media element whose growth should not shift the viewport.
 * @returns A cleanup function that disconnects the observer.
 */
export const preserveScrollOnResize = (
	getContainer: () => HTMLElement | undefined,
	element: HTMLElement,
): (() => void) => {
	// `null` until the first observation establishes a baseline; we only react
	// to subsequent changes so the initial layout pass isn't treated as growth.
	let previousHeight: number | null = null;

	const observer = new ResizeObserver(() => {
		const height = element.offsetHeight;

		if (previousHeight === null) {
			previousHeight = height;
			return;
		}

		const delta = height - previousHeight;
		previousHeight = height;
		if (delta === 0) return;

		const container = getContainer();
		if (!container) return;

		// Only compensate when the growth happens above the visible fold. When the
		// element starts above the container's top edge, its expansion pushes
		// everything below it — including the viewport — down by `delta`; adding
		// the same amount to scrollTop cancels that out. Growth at or below the
		// fold is either what the user is looking at or already off-screen, so we
		// leave it alone (the channel's at-bottom re-pin handles the newest row).
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
