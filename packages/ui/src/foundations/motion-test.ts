export const sampleHeights = (element: Element, durationMs: number) =>
	new Promise<number[]>((resolve) => {
		const samples: number[] = [];
		const start = performance.now();
		const tick = (now: number) => {
			samples.push(element.getBoundingClientRect().height);
			if (now - start < durationMs) requestAnimationFrame(tick);
			else resolve(samples);
		};
		requestAnimationFrame(tick);
	});

export const hasIntermediate = (
	samples: number[],
	from: number,
	to: number,
) => {
	const low = Math.min(from, to) + 2;
	const high = Math.max(from, to) - 2;
	return samples.some((value) => value > low && value < high);
};

export const withSlowMotion = async (run: () => Promise<void>) => {
	const root = document.documentElement;
	const previous = root.dataset.slowMotion;
	root.dataset.slowMotion = "true";
	try {
		await run();
	} finally {
		if (previous === undefined) delete root.dataset.slowMotion;
		else root.dataset.slowMotion = previous;
	}
};

export const recordHeightTransitions = () => {
	let count = 0;
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			const target = record.target as Element;
			if (target.hasAttribute("data-height-transition")) count += 1;
		}
	});
	observer.observe(document.body, {
		subtree: true,
		attributes: true,
		attributeFilter: ["data-height-transition"],
	});
	return {
		count: () => count,
		stop: () => observer.disconnect(),
	};
};
