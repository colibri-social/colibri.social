import { type Accessor, createContext, useContext } from "solid-js";

export const GifLoopContext = createContext<Accessor<number | undefined>>();

export const useGifLoopLimit = (): Accessor<number | undefined> => {
	const limit = useContext(GifLoopContext);
	return () => limit?.();
};
