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
import { asSpaceRef } from "../lexicons";
import { wroteToFrame } from "../sync-frames";
import { flush, initOutbox, onOutboxSent } from "./outbox";
import { flushSends, initSends } from "./sends";

export const OutboxController: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();

	onMount(() => {
		if (user.did) {
			const owner = namespace(getAppViewDid(), user.did);
			void initOutbox(user.atproto.agent, owner);
			void initSends(user.atproto.agent, owner);
		}

		const onFlush = () => {
			void flush();
			void flushSends();
		};
		const onVisible = () => {
			if (document.visibilityState === "visible") onFlush();
		};

		const stopHinting = onOutboxSent(({ space }) => {
			if (!space) return;
			socket.send(wroteToFrame(asSpaceRef(space)));
		});

		window.addEventListener("online", onFlush);
		window.addEventListener("focus", onFlush);
		document.addEventListener("visibilitychange", onVisible);

		onCleanup(() => {
			stopHinting();
			window.removeEventListener("online", onFlush);
			window.removeEventListener("focus", onFlush);
			document.removeEventListener("visibilitychange", onVisible);
		});
	});

	createEffect(() => {
		if (socket.status() !== "connected") return;
		void flush();
		void flushSends();
	});

	return <>{props.children}</>;
};
