import { createDirtyGuard, type DirtySource } from "@colibri-social/ui";

export type LeaveSource = DirtySource & { depth: () => number };

export const createLeaveGuard = (top: () => number) => {
	const guard = createDirtyGuard<LeaveSource>();
	let bypass = false;

	const forced = (action: () => void) => () => {
		const previous = bypass;
		bypass = true;
		try {
			action();
		} finally {
			bypass = previous;
		}
	};

	const holds = (next: number, retry: () => void) =>
		!bypass &&
		guard.hold(forced(retry), (source) => {
			const depth = source.depth();
			return depth > next && depth <= top();
		});

	return {
		guard,
		register: guard.register,
		bypassing: () => bypass,
		holds,
		confirm: (next: number, action: () => void) => {
			if (!holds(next, action)) action();
		},
	};
};

export type LeaveGuard = ReturnType<typeof createLeaveGuard>;
