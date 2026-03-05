import { createContext, type ParentComponent, useContext } from "solid-js";
import type { ChannelData } from "@/utils/sdk";

export type ChannelContextData = {
	channels: () => Array<ChannelData>;
	community: () => string;
};

export const ChannelContext = createContext<ChannelContextData>();

export const ChannelContextProvider: ParentComponent<{
	channels: () => Array<ChannelData>;
	community: () => string;
}> = (props) => {
	const context: ChannelContextData = {
		channels: props.channels,
		community: props.community,
	};

	return (
		<ChannelContext.Provider value={context}>
			{props.children}
		</ChannelContext.Provider>
	);
};

export const useChannelContext = (): ChannelContextData | undefined => {
	return useContext(ChannelContext);
};
