import { normalizeAppViewUrl } from "@colibri-social/lib";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { GlobalIcon } from "@solar-icons/solid/bold/global";
import { MinusCircleIcon } from "@solar-icons/solid/bold/minus-circle";
import {
	createSignal,
	createUniqueId,
	For,
	type JSX,
	Match,
	Show,
	Switch,
} from "solid-js";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { ListGroup, NavRow } from "../List/List";
import { ConfirmDialog } from "../Modal/ConfirmDialog";
import { Modal, ModalContent } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";

export type ServerFeatures = {
	calls: boolean;
	otherServers: boolean;
};

export type ServerCheck =
	| { status: "ok"; url: string; host: string; features: ServerFeatures }
	| { status: "unreachable" }
	| { status: "notColibri" };

export type ServerSection = {
	host: string;
	defaultHost: string;
	onCheck: (url: string) => Promise<ServerCheck>;
	onSwitch: (url: string) => Promise<void> | void;
	onReset: () => Promise<void> | void;
};

type ServerProblem =
	| "empty"
	| "invalid"
	| "same"
	| "unreachable"
	| "notColibri"
	| "switchFailed";

type Phase =
	| { step: "enter" }
	| { step: "checking" }
	| { step: "verified"; check: Extract<ServerCheck, { status: "ok" }> };

const PROBLEM_COPY: Record<ServerProblem, string> = {
	empty: "Enter a server address.",
	invalid: "This isn't a web address. It should look like colibri.example.com.",
	same: "You're already using this server.",
	unreachable:
		"This server didn't answer. Check the address and your connection, then try again.",
	notColibri:
		"This address doesn't run Colibri. Check it with the people who run the server.",
	switchFailed: "Couldn't switch servers. Try again.",
};

const SIGN_OUT_NOTE =
	"Switching signs you out. Sign in again with the same account to continue. Your Spaces and messages stay where they are.";

const hostOf = (url: string) => {
	return new URL(url).host;
};

const FeatureRow = (props: { available: boolean; children: JSX.Element }) => (
	<li
		data-server-feature={props.available ? "available" : "missing"}
		class="flex items-start gap-2.5 text-sm text-foreground"
	>
		<span class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
			<Show when={props.available} fallback={<MinusCircleIcon />}>
				<CheckIcon />
			</Show>
		</span>
		<span class="min-w-0 pt-px text-pretty">{props.children}</span>
	</li>
);

const ServerSummary = (props: {
	check: Extract<ServerCheck, { status: "ok" }>;
}) => {
	const features = () => [
		{ available: true, label: "Delivers your messages and notifications" },
		{
			available: props.check.features.calls,
			label: props.check.features.calls
				? "Connects voice and video calls"
				: "Doesn't connect voice and video calls",
		},
		{
			available: props.check.features.otherServers,
			label: props.check.features.otherServers
				? "Shows Spaces from other Colibri servers"
				: "Only shows Spaces that run on this server",
		},
	];

	return (
		<div data-server-summary="" class="flex flex-col gap-3">
			<div class="flex min-w-0 items-center gap-3 rounded-control bg-secondary p-3">
				<span
					aria-hidden="true"
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground [&>svg]:size-5"
				>
					<GlobalIcon />
				</span>
				<div class="flex min-w-0 flex-col">
					<span class="text-sm font-semibold [overflow-wrap:anywhere] text-foreground">
						{props.check.host}
					</span>
					<span class="text-xs text-muted-foreground">Colibri server</span>
				</div>
			</div>
			<ul class="m-0 flex list-none flex-col gap-2 p-0">
				<For each={features()}>
					{(feature) => (
						<FeatureRow available={feature.available}>
							{feature.label}
						</FeatureRow>
					)}
				</For>
			</ul>
			<Show when={!props.check.features.otherServers}>
				<p
					role="status"
					data-server-warning=""
					class="m-0 flex items-start gap-2 rounded-control-sm border border-warning/40 bg-warning/10 p-3 text-sm text-pretty text-foreground"
				>
					<DangerTriangleIcon
						aria-hidden="true"
						class="mt-0.5 size-4 shrink-0 text-warning"
					/>
					Spaces you joined on other servers won't show up while you use this
					server.
				</p>
			</Show>
			<p class="m-0 text-sm text-pretty text-muted-foreground">
				{SIGN_OUT_NOTE}
			</p>
		</div>
	);
};

export type ServerSwitchDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	host: string;
	onCheck: ServerSection["onCheck"];
	onSwitch: ServerSection["onSwitch"];
};

export const ServerSwitchDialog = (props: ServerSwitchDialogProps) => {
	const [address, setAddress] = createSignal("");
	const [phase, setPhase] = createSignal<Phase>({ step: "enter" });
	const [problem, setProblem] = createSignal<ServerProblem>();
	const [switching, setSwitching] = createSignal(false);
	const formId = createUniqueId();
	let attempt = 0;
	let input: HTMLInputElement | undefined;

	const reset = () => {
		attempt += 1;
		setAddress("");
		setPhase({ step: "enter" });
		setProblem(undefined);
		setSwitching(false);
	};

	const change = (open: boolean) => {
		if (!open && switching()) return;
		if (!open) reset();
		props.onOpenChange(open);
	};

	const check = async () => {
		if (phase().step === "checking") return;

		const raw = address().trim();
		const url = normalizeAppViewUrl(raw);

		if (!raw) return setProblem("empty");
		if (!url) return setProblem("invalid");
		if (hostOf(url) === props.host) return setProblem("same");

		const current = ++attempt;

		setProblem(undefined);
		setPhase({ step: "checking" });

		const result = await props
			.onCheck(url)
			.catch((): ServerCheck => ({ status: "unreachable" }));

		if (current !== attempt) return;

		if (result.status !== "ok") {
			setPhase({ step: "enter" });
			setProblem(result.status);
			queueMicrotask(() => input?.focus());

			return;
		}

		setPhase({ step: "verified", check: result });
	};

	const back = () => {
		setPhase({ step: "enter" });
		setProblem(undefined);
		queueMicrotask(() => input?.focus());
	};

	const confirm = async (url: string) => {
		setSwitching(true);
		setProblem(undefined);

		try {
			await props.onSwitch(url);
		} catch {
			setProblem("switchFailed");
		} finally {
			setSwitching(false);
		}
	};

	const verified = () => {
		const current = phase();

		return current.step === "verified" ? current.check : undefined;
	};

	return (
		<Modal open={props.open} onOpenChange={change}>
			<ModalContent
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					input?.focus();
				}}
				title={
					<Show when={verified()} fallback="Change server">
						{(check) => `Switch to ${check().host}?`}
					</Show>
				}
				description={
					<Show when={!verified()}>
						Enter the address of the Colibri server you want to use. Ask the
						people who run it if you don't know it.
					</Show>
				}
				footer={
					<Switch>
						<Match when={verified()}>
							{(check) => (
								<>
									<Button
										variant="secondary"
										disabled={switching()}
										onClick={back}
									>
										Back
									</Button>
									<Button
										loading={switching()}
										onClick={() => void confirm(check().url)}
									>
										Switch and sign out
									</Button>
								</>
							)}
						</Match>
						<Match when={!verified()}>
							<Button variant="secondary" onClick={() => change(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								form={formId}
								loading={phase().step === "checking"}
							>
								Check server
							</Button>
						</Match>
					</Switch>
				}
			>
				<Show
					when={verified()}
					fallback={
						<form
							id={formId}
							class="flex flex-col"
							onSubmit={(event) => {
								event.preventDefault();
								void check();
							}}
						>
							<TextField
								ref={(element) => {
									input = element;
								}}
								label="Server address"
								value={address()}
								onChange={(value) => {
									setAddress(value);
									setProblem(undefined);
								}}
								readOnly={phase().step === "checking"}
								error={problem() && PROBLEM_COPY[problem() ?? "empty"]}
								placeholder="colibri.example.com"
								inputMode="url"
								autocomplete="url"
							/>
						</form>
					}
				>
					{(check) => (
						<>
							<ServerSummary check={check()} />
							<Show when={problem() === "switchFailed"}>
								<p
									role="alert"
									class="m-0 text-xs font-medium text-destructive"
								>
									{PROBLEM_COPY.switchFailed}
								</p>
							</Show>
						</>
					)}
				</Show>
			</ModalContent>
		</Modal>
	);
};

export const ServerSettingsGroup = (props: { server: ServerSection }) => {
	const [switchOpen, setSwitchOpen] = createSignal(false);
	const [resetOpen, setResetOpen] = createSignal(false);
	const isDefault = () => props.server.host === props.server.defaultHost;

	return (
		<ListGroup label="Server">
			<div
				data-server-current=""
				class="flex w-full shrink-0 flex-col gap-0.5 px-3 py-2"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span
						data-search-label=""
						class="min-w-0 text-sm font-semibold [overflow-wrap:anywhere] text-foreground"
					>
						{props.server.host}
					</span>
					<Show when={isDefault()}>
						<Badge>Default</Badge>
					</Show>
				</div>
				<span
					data-search-description=""
					class="text-xs text-pretty text-muted-foreground"
				>
					Your app connects to this Colibri server. It delivers your messages
					and notifications and connects your calls.
				</span>
			</div>
			<NavRow
				label="Change server"
				keywords={["server", "appview", "host", "address"]}
				onClick={() => setSwitchOpen(true)}
			/>
			<Show when={!isDefault()}>
				<NavRow
					label={`Go back to ${props.server.defaultHost}`}
					chevron={false}
					keywords={["server", "default", "reset"]}
					onClick={() => setResetOpen(true)}
				/>
			</Show>
			<ServerSwitchDialog
				open={switchOpen()}
				onOpenChange={setSwitchOpen}
				host={props.server.host}
				onCheck={props.server.onCheck}
				onSwitch={props.server.onSwitch}
			/>
			<ConfirmDialog
				open={resetOpen()}
				onOpenChange={setResetOpen}
				title={`Go back to ${props.server.defaultHost}?`}
				description={SIGN_OUT_NOTE}
				confirmLabel="Switch and sign out"
				onConfirm={() => props.server.onReset()}
			/>
		</ListGroup>
	);
};
