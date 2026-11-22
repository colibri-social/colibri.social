import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	DeleteAccount,
	type DeleteAccountHost,
	type DeleteAccountState,
} from "@colibri-social/ui";
import { createSignal, onMount } from "solid-js";
import { useAccountActions } from "../../../auth/account-actions";
import { describeError } from "../../../data/error-copy";
import { useData } from "../../../data/store";
import { openExternalUrl } from "../../../native/open-external";

const log = createLogger("delete-account");

export default function DeleteAccountPage() {
	const data = useData();
	const account = useAccountActions();
	const [state, setState] = createSignal<DeleteAccountState>({
		stage: "checking",
	});
	const [host, setHost] = createSignal<DeleteAccountHost>();

	const check = async () => {
		setState({ stage: "checking" });
		try {
			const status = await data.source.getDeletionStatus();
			setHost({
				name: status.host.name ?? "another server",
				contactEmail: status.host.contactEmail,
			});
			setState(
				status.soleOwned.length > 0
					? {
							stage: "blocked",
							spaces: status.soleOwned.map((space) => ({
								name: space.name,
								memberCount: space.memberCount ?? 0,
								picture: space.picture,
							})),
						}
					: { stage: "review" },
			);
		} catch (thrown) {
			const error = classifyThrown(thrown, {
				method: "actor.getDeletionStatus",
			});
			log.warn("could not check the account", { code: error.code });
			setState({
				stage: "review",
				failure: describeError(error).description ?? "Give it another try.",
			});
		}
	};

	const confirm = async () => {
		setState({ stage: "working" });
		try {
			const result = await data.source.deleteColibriData((progress) =>
				setState({ stage: "working", progress }),
			);
			setState({ stage: "done", incomplete: result.incomplete });
		} catch (thrown) {
			const error = classifyThrown(thrown, { method: "actor.deleteAccount" });
			log.warn("could not delete the account", { code: error.code });
			if (error.code === "SoleOwnerOfCommunity") {
				await check();
				return;
			}
			setState({
				stage: "review",
				failure:
					describeError(error).description ??
					"Nothing was removed on the server. Give it another try.",
			});
		}
	};

	onMount(() => void check());

	return (
		<DeleteAccount
			state={state()}
			handle={data.viewer.handle}
			host={host()}
			onConfirm={() => void confirm()}
			onLogOut={() => void account?.signOut()}
			onOpenLink={openExternalUrl}
		/>
	);
}
