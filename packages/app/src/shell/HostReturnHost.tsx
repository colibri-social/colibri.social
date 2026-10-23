import { HostConnected, toast } from "@colibri-social/ui";
import { createSignal, onCleanup, Show } from "solid-js";
import {
	APP_RETURN_HREF,
	type HostReturn,
	hostReturnFailureMessage,
	listenForHostReturn,
} from "../data/host-return";
import { useData } from "../data/store";

type Connected = {
	spaceName?: string;
	iconSrc?: string;
	account?: string;
	server?: string;
};

export const HostReturnHost = () => {
	const data = useData();
	const [connected, setConnected] = createSignal<Connected>();

	const describe = async (request: string): Promise<Connected> => {
		const outcome = await data.source.getCommunityHostAuthorization(request);
		if (outcome.status !== "done") return {};
		const [community, hosting] = await Promise.all([
			data.source.getCommunity(outcome.community),
			data.source.getCommunityHosting(outcome.community),
		]);
		return {
			spaceName: community.name,
			iconSrc: community.picture,
			account: hosting.account,
			server: new URL(hosting.server).host,
		};
	};

	const settle = (outcome: HostReturn) => {
		if (outcome.status === "failed") {
			toast.error(hostReturnFailureMessage(outcome.failure));
			return;
		}
		setConnected({});
		if (!outcome.request) return;
		void describe(outcome.request)
			.then((details) => {
				if (connected()) setConnected(details);
			})
			.catch(() => undefined);
	};

	onCleanup(listenForHostReturn(settle));

	return (
		<Show when={connected()}>
			{(details) => (
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Colibri is connected"
					data-host-return=""
					class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 pt-safe pb-safe"
				>
					<HostConnected
						spaceName={details().spaceName}
						iconSrc={details().iconSrc}
						account={details().account}
						server={details().server}
						openLabel="Continue in this tab"
						onOpen={() => setConnected(undefined)}
						appHref={APP_RETURN_HREF}
					/>
				</div>
			)}
		</Show>
	);
};
