import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { Server2Icon } from "@solar-icons/solid/bold/server-2";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { CopyField } from "../CopyField/CopyField";

export type HostingState = "colibri" | "connected" | "needsSignIn";

export type HostingStatusProps = {
	state: HostingState;
	spaceName: string;
	account: string;
	server: string;
	connectedBy?: string;
	connectedSince?: string;
	lastCheck?: string;
	expiredOn?: string;
	busy?: boolean;
	onSignIn?: () => void;
	onMove?: () => void;
	class?: string;
};

const title: Record<HostingState, string> = {
	colibri: "Hosted by Colibri",
	connected: "Hosted on your own account",
	needsSignIn: "Hosted on your own account",
};

const Pill = (props: {
	tone: "success" | "warning" | "primary";
	label: string;
}) => (
	<span
		data-hosting-pill={props.tone}
		class={cx(
			"inline-flex h-6 shrink-0 items-center gap-1.5 rounded-badge px-2 font-semibold text-xs",
			props.tone === "success" && "bg-success/15 text-success",
			props.tone === "warning" && "bg-warning/15 text-warning",
			props.tone === "primary" && "bg-primary/18 text-primary-highlight",
		)}
	>
		<Show when={props.tone !== "primary"}>
			<span aria-hidden="true" class="size-1.5 rounded-full bg-current" />
		</Show>
		{props.label}
	</span>
);

const Stat = (props: { label: string; children: JSX.Element }) => (
	<div class="flex min-w-0 flex-1 basis-32 flex-col gap-1 rounded-control bg-secondary px-4 py-3">
		<span class="text-muted-foreground text-sm">{props.label}</span>
		<span class="truncate font-semibold text-foreground text-sm">
			{props.children}
		</span>
	</div>
);

export const HostingStatus = (props: HostingStatusProps) => {
	const own = () => props.state !== "colibri";
	return (
		<section
			data-hosting-status={props.state}
			aria-labelledby="hosting-status-title"
			class={cx(
				"flex w-full flex-col gap-5 rounded-surface border border-border bg-card p-5",
				props.class,
			)}
		>
			<div class="flex items-start gap-4">
				<span
					aria-hidden="true"
					class="flex size-12 shrink-0 items-center justify-center rounded-control-lg bg-secondary text-muted-foreground [&>svg]:size-6"
				>
					<Server2Icon />
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
						<h2
							id="hosting-status-title"
							class="m-0 font-bold text-foreground text-lg"
						>
							{title[props.state]}
						</h2>
						<Show when={props.state === "colibri"}>
							<Pill tone="primary" label="Managed for you" />
						</Show>
						<Show when={props.state === "connected"}>
							<Pill tone="success" label="Connected" />
						</Show>
						<Show when={props.state === "needsSignIn"}>
							<Pill tone="warning" label="Needs sign-in" />
						</Show>
					</div>
					<p class="m-0 truncate text-muted-foreground text-sm">
						{props.account} · on {props.server}
					</p>
				</div>
			</div>
			<Show when={props.state === "needsSignIn"}>
				<div
					role="alert"
					class="flex gap-3 rounded-control border border-warning/40 bg-warning/10 p-4"
				>
					<DangerTriangleIcon
						aria-hidden="true"
						class="mt-0.5 size-5 shrink-0 text-warning"
					/>
					<div class="flex min-w-0 flex-col gap-1">
						<span class="font-semibold text-foreground text-sm">
							Sign in again to keep {props.spaceName} running
						</span>
						<span class="text-pretty text-foreground/85 text-sm leading-prose">
							Colibri lost access to {props.account}. People can still read the
							Space, but new messages and changes can't be saved until you sign
							in.
						</span>
					</div>
				</div>
			</Show>
			<Show
				when={own()}
				fallback={<CopyField label="Account" value={props.account} />}
			>
				<div class="flex flex-wrap gap-3">
					<Show when={props.connectedBy}>
						<Stat label="Connected by">@{props.connectedBy}</Stat>
					</Show>
					<Show when={props.connectedSince}>
						<Stat label="Since">{props.connectedSince}</Stat>
					</Show>
					<Show
						when={props.state === "needsSignIn"}
						fallback={
							<Show when={props.lastCheck}>
								<Stat label="Last check">{props.lastCheck}</Stat>
							</Show>
						}
					>
						<Show when={props.expiredOn}>
							<Stat label="Access expired">{props.expiredOn}</Stat>
						</Show>
					</Show>
				</div>
			</Show>
			<div class="flex flex-wrap gap-2">
				<Show when={own()}>
					<Button
						variant={props.state === "needsSignIn" ? "primary" : "secondary"}
						loading={props.busy}
						disabled={props.busy}
						onClick={() => props.onSignIn?.()}
					>
						{props.state === "needsSignIn"
							? `Sign in as ${props.account}`
							: "Sign in again"}
					</Button>
				</Show>
				<Show when={props.onMove}>
					<Button
						variant="secondary"
						disabled={props.busy}
						onClick={() => props.onMove?.()}
					>
						Move to another server
					</Button>
				</Show>
			</div>
		</section>
	);
};
