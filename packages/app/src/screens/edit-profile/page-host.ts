import { type Accessor, createContext, useContext } from "solid-js";

export type PageHost = {
	depth: Accessor<number>;
};

export const PageHostContext = createContext<PageHost>();

export const usePageHost = () => useContext(PageHostContext);
