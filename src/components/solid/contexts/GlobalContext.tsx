import {
	type Accessor,
	createContext,
	createSignal,
	type ParentComponent,
	useContext,
} from "solid-js";
import type { CategoryData, ChannelData, CommunityData } from "@/utils/sdk";

export type GlobalContextData = {
	communities: Array<CommunityData>;
	categories: Array<CategoryData>;
	channels: Array<ChannelData>;
};

export type GlobalContextUtility = {
	addChannel: (channel: ChannelData) => void;
	addCategory: (category: CategoryData) => void;
};

export const GlobalContext =
	createContext<[Accessor<GlobalContextData>, GlobalContextUtility]>();

export const GlobalContextProvider: ParentComponent<{
	contextData: GlobalContextData;
}> = (props) => {
	const [globalContext, setGlobalContext] = createSignal(props.contextData);
	const context: [Accessor<GlobalContextData>, GlobalContextUtility] = [
		globalContext,
		{
			addChannel(channel: ChannelData) {
				const newContext = JSON.parse(JSON.stringify(globalContext));
				newContext.channels.push(channel);
				setGlobalContext(newContext);
			},
			addCategory(category: CategoryData) {
				const newContext = JSON.parse(JSON.stringify(globalContext));
				newContext.categories.push(category);
				setGlobalContext(newContext);
			},
		},
	];

	return (
		<GlobalContext.Provider value={context}>
			{props.children}
		</GlobalContext.Provider>
	);
};

export const useGlobalContext = () => {
	const ctx = useContext(GlobalContext);

	if (!ctx) throw new Error("Unable to get global context!");

	return ctx;
};
