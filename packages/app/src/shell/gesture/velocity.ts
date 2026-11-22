type Sample = { x: number; t: number };

const WINDOW_MS = 100;

export const createVelocityTracker = () => {
	let samples: Sample[] = [];

	const add = (x: number, t: number) => {
		samples.push({ x, t });
		while (samples.length > 2 && t - (samples[0] as Sample).t > WINDOW_MS * 2) {
			samples.shift();
		}
	};

	const velocity = (now: number) => {
		const recent = samples.filter((sample) => now - sample.t <= WINDOW_MS);
		const first = recent[0];
		const last = recent[recent.length - 1];
		if (!first || !last || first === last) return 0;
		const elapsed = last.t - first.t;
		if (elapsed <= 0) return 0;
		return ((last.x - first.x) / elapsed) * 1000;
	};

	const reset = () => {
		samples = [];
	};

	return { add, velocity, reset };
};
