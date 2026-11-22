import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { Server2Icon } from "@solar-icons/solid/bold/server-2";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Spinner } from "../Spinner/Spinner";

export const HOST_SETUP_STEPS = [
	{ id: "signIn", label: "Signed in" },
	{ id: "checkingServer", label: "Checking the server" },
	{ id: "creating", label: "Creating channels and roles" },
] as const;

export type HostSetupStep = (typeof HOST_SETUP_STEPS)[number]["id"] | "done";

export type HostSetupError =
	| "wrongAccount"
	| "spacesUnsupported"
	| "alreadyHosts"
	| "cancelled"
	| "failed";

export type HostSetupProps = {
	spaceName: string;
	account: string;
	step?: HostSetupStep;
	error?: HostSetupError;
	signedInAs?: string;
	server?: string;
	busy?: boolean;
	onReopenSignIn?: () => void;
	onRetry?: () => void;
	onBack?: () => void;
	onUseColibri?: () => void;
	onUseAnotherAccount?: () => void;
	onOpenExisting?: () => void;
	onOpenSpace?: () => void;
	class?: string;
};

const stepDetail = (props: HostSetupProps, id: string, active: boolean) => {
	if (id === "signIn")
		return active ? "Finish signing in in your browser" : props.account;
	if (id === "checkingServer")
		return `Making sure ${props.server ?? "your server"} can host Spaces`;
	return "General, Off-topic and an Owner role for you";
};

const Account = (props: { children: JSX.Element }) => (
	<span class="font-medium text-foreground">{props.children}</span>
);

const ErrorHeading = (props: {
	tone: "destructive" | "info" | "muted";
	icon: JSX.Element;
	title: string;
	children: JSX.Element;
}) => (
	<div class="flex flex-col gap-3">
		<span
			aria-hidden="true"
			class={cx(
				"flex size-10 items-center justify-center rounded-full [&>svg]:size-5",
				props.tone === "destructive" && "bg-destructive/15 text-destructive",
				props.tone === "info" && "bg-info/15 text-info",
				props.tone === "muted" && "bg-muted text-muted-foreground",
			)}
		>
			{props.icon}
		</span>
		<h2 class="m-0 font-semibold text-foreground text-lg">{props.title}</h2>
		<p class="m-0 text-pretty text-muted-foreground text-sm leading-prose">
			{props.children}
		</p>
	</div>
);

export const HostSetup = (props: HostSetupProps) => {
	const current = () =>
		props.step === "done"
			? HOST_SETUP_STEPS.length
			: HOST_SETUP_STEPS.findIndex((step) => step.id === props.step);

	return (
		<div
			data-host-setup={props.error ?? props.step ?? "signIn"}
			class={cx("flex w-full flex-col gap-5", props.class)}
		>
			<Switch>
				<Match when={props.error === "wrongAccount"}>
					<ErrorHeading
						tone="destructive"
						icon={<UserCircleIcon />}
						title="You signed in as a different account"
					>
						You signed in as <Account>{props.signedInAs}</Account>, but this
						Space needs <Account>{props.account}</Account>. Sign out on that
						page, then sign in again as {props.account}.
					</ErrorHeading>
					<div class="flex flex-wrap justify-end gap-2">
						<Button variant="secondary" onClick={() => props.onBack?.()}>
							Back
						</Button>
						<Button onClick={() => props.onRetry?.()}>Try again</Button>
					</div>
				</Match>
				<Match when={props.error === "spacesUnsupported"}>
					<ErrorHeading
						tone="destructive"
						icon={<Server2Icon />}
						title="This server can't host Spaces yet"
					>
						<Account>{props.account}</Account> lives on a server without Spaces
						support. Pick an account on a server that has it, or let Colibri
						host the Space.
					</ErrorHeading>
					<div class="flex flex-wrap justify-end gap-2">
						<Button
							variant="secondary"
							onClick={() => props.onUseAnotherAccount?.()}
						>
							Use another account
						</Button>
						<Button onClick={() => props.onUseColibri?.()}>
							Let Colibri host it
						</Button>
					</div>
				</Match>
				<Match when={props.error === "alreadyHosts"}>
					<ErrorHeading
						tone="info"
						icon={<InfoCircleIcon />}
						title="This account already has a Space"
					>
						Each account can host one Space, and{" "}
						<Account>{props.account}</Account> already hosts one. Use a
						different account for this one.
					</ErrorHeading>
					<div class="flex flex-wrap justify-end gap-2">
						<Show when={props.onOpenExisting}>
							<Button
								variant="secondary"
								onClick={() => props.onOpenExisting?.()}
							>
								Open that Space
							</Button>
						</Show>
						<Button onClick={() => props.onUseAnotherAccount?.()}>
							Use another account
						</Button>
					</div>
				</Match>
				<Match when={props.error === "failed"}>
					<ErrorHeading
						tone="destructive"
						icon={<CloseCircleIcon />}
						title="Colibri couldn't set up the Space"
					>
						Something went wrong after you signed in. Nothing was created. Try
						again in a moment.
					</ErrorHeading>
					<div class="flex flex-wrap justify-end gap-2">
						<Button variant="secondary" onClick={() => props.onBack?.()}>
							Back
						</Button>
						<Button onClick={() => props.onRetry?.()}>Try again</Button>
					</div>
				</Match>
				<Match when={props.error === "cancelled"}>
					<ErrorHeading
						tone="muted"
						icon={<CloseCircleIcon />}
						title="Sign-in was cancelled"
					>
						Nothing was created. Try again when you're ready.
					</ErrorHeading>
					<div class="flex flex-wrap justify-end gap-2">
						<Button variant="secondary" onClick={() => props.onBack?.()}>
							Back
						</Button>
						<Button onClick={() => props.onRetry?.()}>Try again</Button>
					</div>
				</Match>
				<Match when={!props.error}>
					<div class="flex flex-col gap-1">
						<h2 class="m-0 font-semibold text-foreground text-lg">
							Setting up {props.spaceName}
						</h2>
						<p class="m-0 text-muted-foreground text-sm leading-prose">
							This takes a few seconds. You can keep this window open.
						</p>
					</div>
					<ol class="m-0 flex list-none flex-col rounded-control border border-border bg-secondary p-1.5">
						<For each={HOST_SETUP_STEPS}>
							{(step, index) => {
								const state = () =>
									index() < current()
										? "done"
										: index() === current()
											? "active"
											: "pending";
								return (
									<li
										data-host-step={state()}
										class={cx(
											"flex items-start gap-3 rounded-control-sm px-2.5 py-2.5",
										)}
									>
										<span
											aria-hidden="true"
											class="mt-px flex size-5 shrink-0 items-center justify-center [&>svg]:size-5"
										>
											<Switch
												fallback={
													<span class="size-4 rounded-full border-2 border-accent" />
												}
											>
												<Match when={state() === "done"}>
													<CheckCircleIcon class="text-primary" />
												</Match>
												<Match when={state() === "active"}>
													<Spinner size={18} />
												</Match>
											</Switch>
										</span>
										<span class="flex min-w-0 flex-col gap-0.5">
											<span
												class={cx(
													"font-semibold text-sm",
													state() === "pending"
														? "text-muted-foreground"
														: "text-foreground",
												)}
											>
												{step.id === "signIn" && state() === "active"
													? "Waiting for you to sign in"
													: step.label}
											</span>
											<span class="truncate text-muted-foreground text-sm">
												{stepDetail(props, step.id, state() === "active")}
											</span>
										</span>
									</li>
								);
							}}
						</For>
					</ol>
					<div class="flex flex-wrap justify-end gap-2">
						<Show
							when={props.step === "done"}
							fallback={
								<Show when={props.step === "signIn" || !props.step}>
									<Button variant="secondary" onClick={() => props.onBack?.()}>
										Back
									</Button>
									<Button
										variant="secondary"
										onClick={() => props.onReopenSignIn?.()}
									>
										Open the sign-in page again
									</Button>
								</Show>
							}
						>
							<Button onClick={() => props.onOpenSpace?.()}>Open Space</Button>
						</Show>
					</div>
				</Match>
			</Switch>
		</div>
	);
};
