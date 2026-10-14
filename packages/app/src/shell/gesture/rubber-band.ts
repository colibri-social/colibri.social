const RUBBER_COEFFICIENT = 0.55;

export const rubberBand = (overshoot: number, dimension: number) => {
	if (dimension <= 0) return 0;
	const sign = Math.sign(overshoot);
	const distance = Math.abs(overshoot);
	return (
		sign *
		(1 - 1 / ((distance * RUBBER_COEFFICIENT) / dimension + 1)) *
		dimension
	);
};

export const bandedValue = (
	value: number,
	min: number,
	max: number,
	dimension: number,
) => {
	if (value < min) return min + rubberBand(value - min, dimension);
	if (value > max) return max + rubberBand(value - max, dimension);
	return value;
};
