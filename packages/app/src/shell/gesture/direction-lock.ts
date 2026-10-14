export type Axis = "horizontal" | "vertical";

export const LOCK_DISTANCE = 10;
export const HORIZONTAL_MAX_ANGLE = 30;

const tangent = Math.tan((HORIZONTAL_MAX_ANGLE * Math.PI) / 180);

export const decideAxis = (dx: number, dy: number): Axis | null => {
	if (Math.hypot(dx, dy) < LOCK_DISTANCE) return null;
	return Math.abs(dy) <= Math.abs(dx) * tangent ? "horizontal" : "vertical";
};
