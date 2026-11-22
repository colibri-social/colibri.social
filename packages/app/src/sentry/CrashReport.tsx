import { onReportDelivered } from "@colibri-social/lib";
import { ErrorReport, type ErrorReportAccount } from "@colibri-social/ui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { reportingAccount } from "./account";
import { attachAccountToReport } from "./report";

export const CrashReport = (props: { eventId: string | undefined }) => {
	const [delivered, setDelivered] = createSignal(false);
	const [sent, setSent] = createSignal(false);

	createEffect(() => {
		const eventId = props.eventId;
		setDelivered(false);
		setSent(false);
		if (eventId === undefined) return;
		onCleanup(onReportDelivered(eventId, () => setDelivered(true)));
	});

	const account = (): ErrorReportAccount | undefined => {
		const current = reportingAccount();
		if (!current.did) return undefined;
		if (current.optedIn) return "included";
		return sent() ? "sent" : "offer";
	};

	const send = (reference: string) => {
		const did = reportingAccount().did;
		if (did && attachAccountToReport(reference, did)) setSent(true);
	};

	return (
		<Show when={delivered() ? props.eventId : undefined}>
			{(reference) => (
				<ErrorReport
					reference={reference()}
					account={account()}
					onSendAccount={() => send(reference())}
				/>
			)}
		</Show>
	);
};
