import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { SpaceIcon } from "../Space/SpaceIcon";
import { Spinner } from "../Spinner/Spinner";
import { TextField } from "../TextField/TextField";

export type DeleteAccountSpace = {
	name: string;
	memberCount: number;
	picture?: string;
};

export type DeleteAccountProgress =
	| { step: "push" }
	| { step: "records"; done: number; total: number }
	| { step: "server" };

export type DeleteAccountState =
	| { stage: "checking" }
	| { stage: "blocked"; spaces: DeleteAccountSpace[] }
	| { stage: "review"; failure?: JSX.Element }
	| { stage: "working"; progress?: DeleteAccountProgress }
	| { stage: "done"; incomplete?: boolean };

export type DeleteAccountHost = {
	name: string;
	deletionHref?: string;
	deletionLabel?: string;
	contactEmail?: string;
};

export type DeleteAccountProps = {
	state: DeleteAccountState;
	handle: string;
	host?: DeleteAccountHost;
	onConfirm: () => void;
	onLogOut: () => void;
	onOpenLink?: (href: string) => void;
	class?: string;
};

const notice = {
	info: "bg-secondary text-foreground",
	error: "bg-destructive/10 text-destructive",
	success: "bg-secondary text-foreground",
} as const;

const Notice = (props: {
	tone: keyof typeof notice;
	title: JSX.Element;
	children?: JSX.Element;
}) => (
	<div
		role={props.tone === "error" ? "alert" : undefined}
		data-delete-account-notice={props.tone}
		class={cx(
			"flex items-start gap-2 rounded-control px-3 py-2.5 text-sm",
			notice[props.tone],
		)}
	>
		<span class="mt-px flex size-4 shrink-0 [&>svg]:size-4" aria-hidden="true">
			<Switch fallback={<InfoCircleIcon />}>
				<Match when={props.tone === "error"}>
					<DangerCircleIcon />
				</Match>
				<Match when={props.tone === "success"}>
					<CheckCircleIcon class="text-success" />
				</Match>
			</Switch>
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="font-semibold">{props.title}</span>
			<Show when={props.children}>
				<div class="flex flex-col gap-1 text-pretty text-muted-foreground">
					{props.children}
				</div>
			</Show>
		</div>
	</div>
);

const HostNotice = (props: {
	host?: DeleteAccountHost;
	onOpenLink?: (href: string) => void;
}) => (
	<Notice tone="info" title="Your Atmosphere account stays">
		<Show
			when={props.host}
			fallback={<span>This only removes your Colibri data.</span>}
		>
			{(host) => (
				<span>
					This only removes your Colibri data. Your handle and everything
					outside Colibri live on {host().name}, which Colibri doesn't run.
					<Show when={host().deletionHref}>
						{(href) => (
							<>
								{" "}
								To delete that account too, go to{" "}
								<a
									href={href()}
									target="_blank"
									rel="noreferrer"
									class="font-semibold text-foreground underline focus-ring rounded-control-xs"
									onClick={(event) => {
										if (!props.onOpenLink) return;
										event.preventDefault();
										props.onOpenLink(href());
									}}
								>
									{host().deletionLabel ?? "your account settings"}
								</a>
								.
							</>
						)}
					</Show>
					<Show when={!host().deletionHref && host().contactEmail}>
						{(email) => (
							<>
								{" "}
								To delete that account too, contact the people who run it at{" "}
								<a
									href={`mailto:${email()}`}
									class="font-semibold text-foreground underline focus-ring rounded-control-xs"
									onClick={(event) => {
										if (!props.onOpenLink) return;
										event.preventDefault();
										props.onOpenLink(`mailto:${email()}`);
									}}
								>
									{email()}
								</a>
								.
							</>
						)}
					</Show>
				</span>
			)}
		</Show>
	</Notice>
);

const progressText = (progress?: DeleteAccountProgress) => {
	if (!progress) return "Getting ready.";
	if (progress.step === "push") return "Turning off notifications.";
	if (progress.step === "server") return "Clearing your data from Colibri.";
	return `Deleting your messages and settings (${Math.min(progress.done + 1, progress.total)} of ${progress.total}).`;
};

const plainHandle = (handle: string) =>
	handle.replace(/^at:\/\//, "").replace(/^@/, "");

export const DeleteAccount = (props: DeleteAccountProps) => {
	const [confirmation, setConfirmation] = createSignal("");
	const expected = () => plainHandle(props.handle).toLowerCase();
	const confirmed = () =>
		plainHandle(confirmation().trim()).toLowerCase() === expected();
	const spaces = () =>
		props.state.stage === "blocked" ? props.state.spaces : [];
	const failure = () =>
		props.state.stage === "review" ? props.state.failure : undefined;
	const progress = () =>
		props.state.stage === "working" ? props.state.progress : undefined;
	const incomplete = () =>
		props.state.stage === "done" && props.state.incomplete === true;

	return (
		<div
			data-delete-account={props.state.stage}
			class={cx("flex w-full min-w-0 flex-col gap-4", props.class)}
		>
			<Switch>
				<Match when={props.state.stage === "checking"}>
					<div
						role="status"
						class="flex items-center gap-2 text-sm text-muted-foreground"
					>
						<Spinner size={16} />
						Checking what deleting would remove.
					</div>
				</Match>
				<Match when={props.state.stage === "blocked"}>
					<Notice tone="error" title="Hand over your Spaces first">
						<span>
							You're the only owner of these Spaces. Give ownership to someone
							else or delete each Space, then come back.
						</span>
					</Notice>
					<ul class="m-0 flex list-none flex-col gap-3 p-0">
						<For each={spaces()}>
							{(space) => (
								<li class="flex min-w-0 items-center gap-3">
									<SpaceIcon name={space.name} src={space.picture} size={32} />
									<div class="flex min-w-0 flex-col">
										<span class="truncate text-sm font-semibold text-foreground">
											{space.name}
										</span>
										<span class="text-xs text-muted-foreground tabular-nums">
											{space.memberCount}{" "}
											{space.memberCount === 1 ? "member" : "members"}
										</span>
									</div>
								</li>
							)}
						</For>
					</ul>
					<HostNotice host={props.host} onOpenLink={props.onOpenLink} />
				</Match>
				<Match when={props.state.stage === "review"}>
					<Show when={failure()}>
						<Notice tone="error" title="Deleting didn't finish">
							<span>{failure()}</span>
						</Notice>
					</Show>
					<div class="flex flex-col gap-2 text-sm text-foreground">
						<p class="m-0 text-pretty">
							Deleting removes your Colibri profile and status, every message
							and reaction you've sent, your Space memberships, your
							notifications, what you've read, and any invite links you made.
						</p>
						<p class="m-0 text-pretty">
							<strong>You can't undo this.</strong> To confirm, type your handle
							below.
						</p>
					</div>
					<HostNotice host={props.host} onOpenLink={props.onOpenLink} />
					<TextField
						label="Your handle"
						value={confirmation()}
						onChange={setConfirmation}
						placeholder={plainHandle(props.handle)}
						autocomplete="off"
					/>
					<Button
						variant="destructive"
						block
						disabled={!confirmed()}
						onClick={() => props.onConfirm()}
					>
						Delete my Colibri data
					</Button>
				</Match>
				<Match when={props.state.stage === "working"}>
					<div
						role="status"
						aria-live="polite"
						class="flex items-center gap-2 text-sm text-foreground"
					>
						<Spinner size={16} />
						<span>{progressText(progress())}</span>
					</div>
				</Match>
				<Match when={props.state.stage === "done"}>
					<Show
						when={incomplete()}
						fallback={
							<Notice tone="success" title="Your Colibri data is deleted">
								<span>Nothing of yours is left on Colibri.</span>
							</Notice>
						}
					>
						<Notice tone="error" title="A few items are still saved">
							<span>
								Colibri no longer has your data, but a few items are still
								stored with your Atmosphere account. Log in again and delete
								once more to remove them.
							</span>
						</Notice>
					</Show>
					<HostNotice host={props.host} onOpenLink={props.onOpenLink} />
					<Button block onClick={() => props.onLogOut()}>
						Log out
					</Button>
				</Match>
			</Switch>
		</div>
	);
};
