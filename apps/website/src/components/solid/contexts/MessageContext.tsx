import { createContext, type ParentComponent, useContext } from "solid-js";

export type MessageContextData = {};

export type MessageContextUtility = {};

export const MessageContext =
	createContext<[MessageContextData, MessageContextUtility]>();

export const MessageContextProvider: ParentComponent = (props) => {
	const context: [MessageContextData, MessageContextUtility] = [{}, {}];

	return (
		<MessageContext.Provider value={context}>
			{props.children}
		</MessageContext.Provider>
	);
};

export const useMessageContext = () => {
	const ctx = useContext(MessageContext);

	if (!ctx) throw new Error("Unable to get message context!");

	return ctx;
};
