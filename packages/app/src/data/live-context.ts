import { type Accessor, createContext, useContext } from "solid-js";
import type { LiveStatus } from "./remote/live";

export type LiveStatusSource = {
	status: Accessor<LiveStatus>;
	retryAt: Accessor<number | undefined>;
	retry: () => void;
};

export const LiveStatusContext = createContext<LiveStatusSource>();

export const useLiveStatus = () => useContext(LiveStatusContext);
