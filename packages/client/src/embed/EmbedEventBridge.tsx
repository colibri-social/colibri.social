import { onCleanup } from "solid-js";
import { useSocketContext } from "../contexts/Socket";
import { useEmbedEmitter } from "./context";

export const EmbedEventBridge = () => {
	const socket = useSocketContext();
	const emitter = useEmbedEmitter();

	if (!emitter) return null;

	onCleanup(
		socket.onEvent((event) => emitter.emit({ kind: "realtime", event })),
	);

	return null;
};
