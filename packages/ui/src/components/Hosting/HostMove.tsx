import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { ArrowRightUpIcon } from "@solar-icons/solid/linear/arrow-right-up";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import {
	createSignal,
	type JSX,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { CopyField } from "../CopyField/CopyField";
import { ConfirmDialog } from "../Modal/ConfirmDialog";
import { Spinner } from "../Spinner/Spinner";
import { TextField } from "../TextField/TextField";

export type HostMoveStep = 1 | 2 | 3 | 4 | 5 | "done";

export type HostCheckState = "idle" | "checking" | "supported" | "unsupported";

export type HostMoveProps = {
	spaceName: string;
	account: string;
	step: HostMoveStep;
	server: string;
	onServerChange: (server: string) => void;
	check: HostCheckState;
	onCheck: () => void;
	onContinue: () => void;
	onChangeServer: () => void;
	email: string;
	onEmailChange: (email: string) => void;
	password?: string;
	passwordExpiresAt?: number;
	onHandOver: () => Promise<void> | void;
	onRestartHandOver?: () => void;
	onOpenMoover: () => void;
	onMoved: () => void;
	reconnectBusy?: boolean;
	onReconnect: () => void;
	restoreAvailable?: boolean;
	onBackToHosting?: () => void;
	class?: string;
};

export const pdsMooverUrl = (server: string) =>
	`https://pdsmoover.com/moover/${encodeURIComponent(server.trim())}`;

export const HAND_OVER_MINUTES = 60;

const CLOCK_TICK_MS = 15_000;
const EXPIRY_WARNING_MINUTES = 10;

const order = (step: HostMoveStep) => (step === "done" ? 6 : step);

const clockTime = (at: number) =>
	new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(at);

const minutesLabel = (minutes: number) =>
	minutes === 1 ? "1 minute" : `${minutes} minutes`;

const PasswordExpiry = (props: { expiresAt: number; now: number }) => {
	const minutes = () =>
		Math.max(1, Math.ceil((props.expiresAt - props.now) / 60_000));
	const soon = () => minutes() <= EXPIRY_WARNING_MINUTES;
	return (
		<p
			data-password-expiry={soon() ? "soon" : "later"}
			class={cx(
				"m-0 text-sm leading-prose",
				soon() ? "text-warning" : "text-muted-foreground",
			)}
		>
			This password stops working in {minutesLabel(minutes())}, at{" "}
			{clockTime(props.expiresAt)}. Finish the move before then.
		</p>
	);
};

const PasswordExpired = (props: { onRestart?: () => void }) => (
	<div
		role="alert"
		data-password-expired=""
		class="flex gap-3 rounded-control border border-warning/40 bg-warning/10 p-4"
	>
		<DangerTriangleIcon
			aria-hidden="true"
			class="mt-0.5 size-5 shrink-0 text-warning"
		/>
		<div class="flex min-w-0 flex-col gap-3">
			<div class="flex flex-col gap-1">
				<span class="font-semibold text-foreground text-sm">
					The password expired
				</span>
				<span class="text-pretty text-foreground/85 text-sm leading-prose">
					The account didn't move within {HAND_OVER_MINUTES} minutes, so Colibri
					changed the password to keep the Space safe. Get a new one to try
					again.
				</span>
			</div>
			<Show when={props.onRestart}>
				<div>
					<Button onClick={() => props.onRestart?.()}>
						Get a new password
					</Button>
				</div>
			</Show>
		</div>
	</div>
);

type StepState = "done" | "active" | "pending";

const MoveStep = (props: {
	number: number;
	state: StepState;
	title: string;
	summary?: JSX.Element;
	action?: JSX.Element;
	extra?: JSX.Element;
	children?: JSX.Element;
}) => (
	<li
		data-move-step={props.number}
		data-state={props.state}
		aria-current={props.state === "active" ? "step" : undefined}
		class={cx(
			"flex gap-3.5 border-0 border-b border-border border-solid p-4 last:border-b-0",
			props.state === "active" && "bg-popover",
		)}
	>
		<span
			aria-hidden="true"
			class={cx(
				"flex size-7 shrink-0 items-center justify-center rounded-full font-bold text-[13px]",
				props.state === "done" && "bg-primary-fill text-primary-foreground",
				props.state === "active" &&
					"border-2 border-primary text-primary-highlight",
				props.state === "pending" &&
					"border-2 border-accent text-muted-foreground",
			)}
		>
			<Show when={props.state === "done"} fallback={props.number}>
				<CheckIcon class="size-4" />
			</Show>
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			<div class="flex items-start gap-3">
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<h2
						class={cx(
							"m-0 font-semibold text-base",
							props.state === "pending"
								? "text-muted-foreground"
								: "text-foreground",
						)}
					>
						{props.title}
					</h2>
					<Show when={props.summary}>
						<p class="m-0 text-pretty text-muted-foreground text-sm leading-prose">
							{props.summary}
						</p>
					</Show>
				</div>
				{props.action}
			</div>
			{props.extra}
			<Show when={props.state === "active"}>{props.children}</Show>
		</div>
	</li>
);

const CheckResult = (props: { check: HostCheckState; server: string }) => (
	<Switch>
		<Match when={props.check === "checking"}>
			<p
				role="status"
				class="m-0 flex items-center gap-2 text-muted-foreground text-sm"
			>
				<Spinner size={16} />
				Checking {props.server}
			</p>
		</Match>
		<Match when={props.check === "supported"}>
			<p role="status" class="m-0 flex items-start gap-2 text-sm text-success">
				<CheckCircleIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
				This server supports Spaces. You can continue.
			</p>
		</Match>
		<Match when={props.check === "unsupported"}>
			<p
				role="alert"
				class="m-0 flex items-start gap-2 text-destructive text-sm"
			>
				<CloseCircleIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
				This server can't host Spaces yet, so the Space would stop working
				there. Pick a server with Spaces support.
			</p>
		</Match>
	</Switch>
);

export const HostMove = (props: HostMoveProps) => {
	const [confirming, setConfirming] = createSignal(false);
	const [now, setNow] = createSignal(Date.now());
	const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
	onCleanup(() => clearInterval(clock));
	const expired = () =>
		!!props.password &&
		props.passwordExpiresAt !== undefined &&
		now() >= props.passwordExpiresAt;
	const state = (number: number): StepState =>
		number < order(props.step)
			? "done"
			: number === order(props.step)
				? "active"
				: "pending";

	return (
		<div
			data-host-move={props.step}
			class={cx("flex w-full flex-col gap-5", props.class)}
		>
			<Show when={props.step === "done"}>
				<div
					role="status"
					class="flex flex-wrap items-center gap-3.5 rounded-surface border border-border bg-card p-4"
				>
					<span
						aria-hidden="true"
						class="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success [&>svg]:size-5"
					>
						<CheckCircleIcon />
					</span>
					<div class="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
						<span class="font-semibold text-base text-foreground">
							{props.spaceName} lives on {props.server} now
						</span>
						<span class="text-muted-foreground text-sm">
							Members won't notice a thing.
						</span>
					</div>
					<Show when={props.onBackToHosting}>
						<Button
							variant="secondary"
							onClick={() => props.onBackToHosting?.()}
						>
							Back to Hosting
						</Button>
					</Show>
				</div>
			</Show>
			<ol class="m-0 flex list-none flex-col overflow-hidden rounded-surface border border-border bg-card p-0">
				<MoveStep
					number={1}
					state={state(1)}
					title="Check the new server"
					summary={
						state(1) === "done"
							? `${props.server} supports Spaces.`
							: "Enter the address of the server you're moving to."
					}
					action={
						<Show when={state(1) === "done" && order(props.step) < 4}>
							<Button
								variant="secondary"
								class="h-8 px-3"
								onClick={() => props.onChangeServer()}
							>
								Change
							</Button>
						</Show>
					}
				>
					<form
						class="flex flex-col gap-3"
						onSubmit={(event) => {
							event.preventDefault();
							props.onCheck();
						}}
					>
						<div class="flex items-end gap-2">
							<TextField
								label="New server"
								placeholder="pds.example.com"
								class="min-w-0 flex-1"
								value={props.server}
								onChange={props.onServerChange}
							/>
							<Button
								type="submit"
								variant="secondary"
								disabled={!props.server.trim() || props.check === "checking"}
							>
								Check
							</Button>
						</div>
						<CheckResult check={props.check} server={props.server} />
						<Show when={props.check === "supported"}>
							<div>
								<Button type="button" onClick={() => props.onContinue()}>
									Continue
								</Button>
							</div>
						</Show>
					</form>
				</MoveStep>
				<MoveStep
					number={2}
					state={state(2)}
					title="Get the keys to the Space's account"
					summary={
						state(2) === "done"
							? `Codes for the move go to ${props.email}. Save this password now. Colibri won't show it again, and it only works for ${HAND_OVER_MINUTES} minutes.`
							: "Right now only Colibri can sign in to this account. You need its password and the codes the server sends by email."
					}
					extra={
						<Show
							when={
								state(2) === "done" && props.password && order(props.step) <= 3
							}
						>
							<Show
								when={!expired()}
								fallback={
									<PasswordExpired onRestart={props.onRestartHandOver} />
								}
							>
								<div class="flex flex-col gap-2">
									<CopyField
										label="Password"
										value={props.password ?? ""}
										copyLabel="Copy password"
									/>
									<Show when={props.passwordExpiresAt}>
										{(expiresAt) => (
											<PasswordExpiry expiresAt={expiresAt()} now={now()} />
										)}
									</Show>
								</div>
							</Show>
						</Show>
					}
				>
					<div class="flex flex-col gap-3">
						<TextField
							label="Your email"
							type="email"
							autocomplete="email"
							value={props.email}
							onChange={props.onEmailChange}
							description="The server sends the codes for the move here."
						/>
						<div>
							<Button
								variant="destructive"
								disabled={!props.email.includes("@")}
								onClick={() => {
									setConfirming(true);
								}}
							>
								Get the password
							</Button>
						</div>
					</div>
				</MoveStep>
				<MoveStep
					number={3}
					state={state(3)}
					title="Move the account with PDS MOOver"
					summary="Sign in there with the account name and password above. At the end it asks for a code sent to your email."
				>
					<div class="flex flex-col gap-3">
						<CopyField label="Account name" value={props.account} />
						<div class="flex flex-wrap gap-2">
							<Button
								icon={<ArrowRightUpIcon />}
								disabled={expired()}
								onClick={() => props.onOpenMoover()}
							>
								Open PDS MOOver
							</Button>
							<Button
								variant="secondary"
								disabled={expired()}
								onClick={() => props.onMoved()}
							>
								I've moved it
							</Button>
						</div>
					</div>
				</MoveStep>
				<MoveStep
					number={4}
					state={state(4)}
					title="Reconnect Colibri"
					summary={`Sign in as ${props.account} on ${props.server || "the new server"} so Colibri can keep running the Space.`}
				>
					<div>
						<Button
							loading={props.reconnectBusy}
							disabled={props.reconnectBusy}
							onClick={() => props.onReconnect()}
						>
							Sign in on {props.server || "the new server"}
						</Button>
					</div>
				</MoveStep>
				<MoveStep
					number={5}
					state={state(5)}
					title="Bring the Space back online"
					summary={
						props.restoreAvailable
							? "Colibri restores channels and members on the new server."
							: `Moving a Space's channels and members between servers isn't possible yet. This step unlocks once servers support it. Until then, ${props.spaceName} stays where it is.`
					}
					action={
						<Show when={!props.restoreAvailable && state(5) !== "done"}>
							<span class="inline-flex h-6 shrink-0 items-center rounded-badge bg-secondary px-2 font-semibold text-muted-foreground text-xs">
								Coming later
							</span>
						</Show>
					}
				>
					<Show when={props.restoreAvailable}>
						<p
							role="status"
							class="m-0 flex items-center gap-2 text-muted-foreground text-sm"
						>
							<Spinner size={16} />
							Restoring channels and members
						</p>
					</Show>
				</MoveStep>
			</ol>
			<ConfirmDialog
				open={confirming()}
				onOpenChange={setConfirming}
				tone="destructive"
				title="Hand over the account?"
				description={`Colibri sets ${props.email} as the account's email and shows you a new password once. It works for ${HAND_OVER_MINUTES} minutes. Anyone with it controls ${props.spaceName}, and can delete it.`}
				confirmLabel="Hand over"
				onConfirm={() => props.onHandOver()}
			/>
		</div>
	);
};
