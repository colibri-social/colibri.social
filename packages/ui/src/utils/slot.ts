import { children, type JSX } from "solid-js";

const isRendered = (node: unknown) =>
	node !== undefined && node !== null && node !== false && node !== "";

export const createSlot = (read: () => JSX.Element) => {
	const resolved = children(read);
	const has = () => resolved.toArray().some(isRendered);
	return Object.assign(resolved, { has });
};
