import { createContext, type JSX, useContext } from "solid-js";
import type { RichEditorSources } from "./types";

const RichEditorContext = createContext<RichEditorSources>({});

export const RichEditorProvider = (props: {
	sources: RichEditorSources;
	children: JSX.Element;
}) => (
	<RichEditorContext.Provider value={props.sources}>
		{props.children}
	</RichEditorContext.Provider>
);

export const useRichEditorSources = () => useContext(RichEditorContext);
