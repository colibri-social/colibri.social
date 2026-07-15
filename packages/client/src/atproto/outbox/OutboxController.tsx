import {
	createEffect,
	onCleanup,
	onMount,
	type ParentComponent,
} from "solid-js";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { getAppViewDid } from "../../utils/appview";
import { namespace } from "../cache/keys";
import { flush, initOutbox } from "./outbox";

export const OutboxController: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();

	onMount(() => {
		if (user.did) {
			void initOutbox(user.atproto.agent, namespace(getAppViewDid(), user.did));
		}

		const onFlush = () => void flush();
		const onVisible = () => {
			if (document.visibilityState === "visible") void flush();
		};

		window.addEventListener("online", onFlush);
		window.addEventListener("focus", onFlush);
		document.addEventListener("visibilitychange", onVisible);

		onCleanup(() => {
			window.removeEventListener("online", onFlush);
			window.removeEventListener("focus", onFlush);
			document.removeEventListener("visibilitychange", onVisible);
		});
	});

	createEffect(() => {
		if (socket.status() === "connected") void flush();
	});

	return <>{props.children}</>;
};
