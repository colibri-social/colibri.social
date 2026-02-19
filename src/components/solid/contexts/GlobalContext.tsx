import {
	type Accessor,
	createContext,
	createSignal,
	type ParentComponent,
	useContext,
} from "solid-js";
import type {
	CategoryData,
	ChannelData,
	CommunityData,
	MessageData,
} from "@/utils/sdk";
import { createStore } from "solid-js/store";

export type GlobalContextData = {
	communities: Array<CommunityData>;
	categories: Array<CategoryData>;
	channels: Array<ChannelData>;
	pendingMessages: Array<PendingMessageData>;
	user: App.SessionData["user"];
};

export type GlobalContextUtility = {
	addChannel: (channel: ChannelData) => void;
	addCategory: (category: CategoryData) => void;
	addPendingMessage: (message: PendingMessageData) => void;
	removePendingMessage: (hash: string) => void;
};

export type PendingMessageData = Omit<MessageData, "rkey"> & {
	hash: string;
};

export const GlobalContext =
	createContext<[GlobalContextData, GlobalContextUtility]>();

export const GlobalContextProvider: ParentComponent<{
	contextData: GlobalContextData;
}> = (props) => {
	const [globalContext, setGlobalContext] = createStore(props.contextData);

	const context: [GlobalContextData, GlobalContextUtility] = [
		globalContext,
		{
			addChannel(channel: ChannelData) {
				setGlobalContext("channels", (list) => [...list, channel]);
			},
			addCategory(category: CategoryData) {
				setGlobalContext("categories", (list) => [...list, category]);
			},
			addPendingMessage(message: PendingMessageData) {
				setGlobalContext("pendingMessages", (list) => [...list, message]);
			},
			removePendingMessage(hash: string) {
				setGlobalContext("pendingMessages", (list) =>
					list.filter((m) => m.hash !== hash),
				);
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
