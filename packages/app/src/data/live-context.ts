import { type Accessor, createContext, useContext } from "solid-js";
import type { DrainNotice, LiveStatus, WriteMode } from "./remote/live";

export type LiveStatusSource = {
	status: Accessor<LiveStatus>;
	retryAt: Accessor<number | undefined>;
	retry: () => void;
	writeMode?: Accessor<WriteMode>;
	drain?: Accessor<DrainNotice | undefined>;
};

export const LiveStatusContext = createContext<LiveStatusSource>();

export const useLiveStatus = () => useContext(LiveStatusContext);
