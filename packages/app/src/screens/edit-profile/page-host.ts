import { type Accessor, createContext, useContext } from "solid-js";

export type PageGuard = {
	blocked: () => boolean;
	onBlocked: () => void;
};

export type LeaveReason = "discard" | "saved";

export type PageHost = {
	depth: Accessor<number>;
	register: (guard: PageGuard) => () => void;
	proceed: (reason: LeaveReason) => void;
};

export const PageHostContext = createContext<PageHost>();

export const usePageHost = () => useContext(PageHostContext);
