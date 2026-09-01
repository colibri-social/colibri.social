import { createSignal } from "solid-js";

export type ChannelTab = "chat" | "threads";

const [state, setState] = createSignal<{ space: string; tab: ChannelTab }>({
	space: "",
	tab: "chat",
});

export const channelTab = (space: string): ChannelTab =>
	state().space === space ? state().tab : "chat";

export const showChannelTab = (space: string, tab: ChannelTab): void => {
	setState({ space, tab });
};
