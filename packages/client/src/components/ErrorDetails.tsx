import { createSignal, Show } from "solid-js";
import { reportingAccount } from "../errors/account";
import { attachAccountToReport } from "../errors/report";
import { Button } from "./ui/Button";

export interface ErrorDetailsProps {
	code?: string;
	eventId?: string;
}

export const ErrorDetails = (props: ErrorDetailsProps) => {
	const [expanded, setExpanded] = createSignal(false);
	const [copied, setCopied] = createSignal(false);
	const [accountSent, setAccountSent] = createSignal(false);

	const account = reportingAccount();

	const canOfferAccount = () =>
		account.did !== undefined &&
		!account.optedIn &&
		props.eventId !== undefined &&
		!accountSent();

	const summary = () =>
		[
			props.code ? `Code: ${props.code}` : undefined,
			props.eventId ? `Reference: ${props.eventId}` : undefined,
		]
			.filter(Boolean)
			.join("\n");

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(summary());
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	const sendAccount = () => {
		if (!account.did) return;
		if (attachAccountToReport(props.eventId, account.did)) setAccountSent(true);
	};

	return (
		<Show when={props.code || props.eventId}>
			<div class="flex flex-col items-center gap-2 text-xs text-muted-foreground">
				<button
					type="button"
					class="underline cursor-pointer"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded() ? "Hide details" : "Details"}
				</button>

				<Show when={expanded()}>
					<div class="flex flex-col items-center gap-3 max-w-md">
						<pre class="m-0 whitespace-pre-wrap break-all text-left font-mono text-[11px] leading-relaxed">
							{summary()}
						</pre>

						<div class="flex flex-wrap items-center justify-center gap-2">
							<Button variant="secondary" size="sm" onClick={copy}>
								{copied() ? "Copied" : "Copy"}
							</Button>

							<Show when={canOfferAccount()}>
								<Button variant="outline" size="sm" onClick={sendAccount}>
									Send my account
								</Button>
							</Show>
							<Show when={accountSent()}>
								<span>Account sent, thank you.</span>
							</Show>
							<Show when={account.optedIn}>
								<span>Your account is already included.</span>
							</Show>
						</div>

						<Show when={canOfferAccount()}>
							<p class="m-0 text-center">
								Sending your account lets us see how many people this affects
								and follow up with you. Nothing is sent unless you tap it.
							</p>
						</Show>
					</div>
				</Show>
			</div>
		</Show>
	);
};
