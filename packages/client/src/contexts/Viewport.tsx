import { createContext, type ParentComponent, useContext } from "solid-js";
import {
	createViewportMetrics,
	type ViewportMetrics,
} from "../utils/visual-viewport";

export const ViewportContext = createContext<ViewportMetrics>();

export const ViewportProvider: ParentComponent = (props) => {
	const metrics = createViewportMetrics();

	return (
		<ViewportContext.Provider value={metrics}>
			{props.children}
		</ViewportContext.Provider>
	);
};

export const useViewport = (): ViewportMetrics => {
	const ctx = useContext(ViewportContext);

	if (!ctx) {
		throw new Error("Unable to get viewport context.");
	}

	return ctx;
};
