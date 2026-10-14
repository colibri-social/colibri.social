export type SpringParams = {
	response: number;
	dampingRatio: number;
};

export type SpringState = {
	position: number;
	velocity: number;
};

export const paneSpring: SpringParams = { response: 0.38, dampingRatio: 1 };

const STEP_SECONDS = 1 / 240;
const REST_POSITION = 0.0005;
const REST_VELOCITY = 0.01;

export const springCoefficients = (params: SpringParams) => {
	const omega = (2 * Math.PI) / params.response;
	return {
		stiffness: omega * omega,
		damping: 2 * params.dampingRatio * omega,
	};
};

export const stepSpring = (
	state: SpringState,
	target: number,
	params: SpringParams,
	seconds: number,
): SpringState => {
	const { stiffness, damping } = springCoefficients(params);
	let { position, velocity } = state;
	let remaining = seconds;
	while (remaining > 0) {
		const dt = Math.min(STEP_SECONDS, remaining);
		const acceleration = -stiffness * (position - target) - damping * velocity;
		velocity += acceleration * dt;
		position += velocity * dt;
		remaining -= dt;
	}
	return { position, velocity };
};

export const isAtRest = (state: SpringState, target: number) =>
	Math.abs(state.position - target) < REST_POSITION &&
	Math.abs(state.velocity) < REST_VELOCITY;
