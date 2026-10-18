import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { UserIcon } from "@solar-icons/solid/bold/user";
import { Match, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { cardSurface } from "../Card/Card";
import { CopyField } from "../CopyField/CopyField";

export type ErrorReportAccount = "offer" | "sending" | "sent" | "included";

export type ErrorReportProps = {
	reference: string;
	account?: ErrorReportAccount;
	onSendAccount?: () => unknown;
	class?: string;
};

export const ErrorReport = (props: ErrorReportProps) => (
	<section
		data-error-report=""
		aria-label="Error report"
		class={cx(cardSurface(), "flex w-full flex-col text-left", props.class)}
	>
		<div class="flex flex-col gap-2 p-3">
			<p class="m-0 text-sm leading-prose text-pretty text-muted-foreground">
				If you contact us, share this reference so we can find what happened!
			</p>
			<CopyField
				value={props.reference}
				aria-label="Error reference"
				copyLabel="Copy reference"
				copiedMessage="Reference copied"
			/>
		</div>
		<Switch>
			<Match when={props.account === "offer" || props.account === "sending"}>
				<div
					data-error-report-account=""
					class="flex flex-col gap-2 border-t border-border p-3"
				>
					<Button
						block
						variant="secondary"
						icon={<UserIcon />}
						loading={props.account === "sending"}
						onClick={() => props.onSendAccount?.()}
					>
						Send my account with this report
					</Button>
					<p class="m-0 text-xs leading-prose text-pretty text-muted-foreground">
						This lets us see how many people it affects and follow up with you.
						Nothing is sent unless you tap it.
					</p>
				</div>
			</Match>
			<Match when={props.account === "sent" || props.account === "included"}>
				<p
					data-error-report-account=""
					role="status"
					class="m-0 flex items-center gap-2 border-t border-border p-3 text-sm text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-success"
				>
					<CheckCircleIcon />
					{props.account === "sent"
						? "Your account was added to this report. Thank you."
						: "Your account is already included in this report."}
				</p>
			</Match>
		</Switch>
	</section>
);
