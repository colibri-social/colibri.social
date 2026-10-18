import { type Accessor, createContext, useContext } from "solid-js";

export type MessageListItemState = {
	key: string;
	position: Accessor<number>;
	setSize: Accessor<number>;
	active: Accessor<boolean>;
	jumped: Accessor<boolean>;
};

export const MessageListItemContext = createContext<MessageListItemState>();

export const useMessageListItem = () => useContext(MessageListItemContext);
