import { createContext, type ParentComponent, useContext } from "solid-js";
import type { ColibriEmbedConfig, EmbedEmitter } from "./types";

export type EmbedRuntime = {
	config: ColibriEmbedConfig;
	communityUri: string;
	communitySegment: string;
	emitter: EmbedEmitter;
	root: HTMLElement;
	goToChannel: ((rkey: string, type?: string) => void) | undefined;
};

const EmbedContext = createContext<EmbedRuntime>();

export const EmbedRuntimeProvider: ParentComponent<{
	runtime: EmbedRuntime;
}> = (props) => (
	<EmbedContext.Provider value={props.runtime}>
		{props.children}
	</EmbedContext.Provider>
);

export const useEmbedRuntime = (): EmbedRuntime | undefined =>
	useContext(EmbedContext);

export const useIsEmbedded = (): boolean =>
	useContext(EmbedContext) !== undefined;

export const useEmbedEmitter = (): EmbedEmitter | undefined =>
	useContext(EmbedContext)?.emitter;

export const usePortalMount = (): HTMLElement | undefined =>
	useContext(EmbedContext)?.root;
