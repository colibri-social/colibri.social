export const DECELERATION_RATE = 0.998;

export const projectDistance = (
	velocityPerSecond: number,
	decelerationRate = DECELERATION_RATE,
) => ((velocityPerSecond / 1000) * decelerationRate) / (1 - decelerationRate);

export const projectedTarget = (options: {
	position: number;
	velocity: number;
	min: number;
	max: number;
}) => {
	const projected = options.position + projectDistance(options.velocity);
	const clamped = Math.min(options.max, Math.max(options.min, projected));
	return Math.round(clamped);
};
