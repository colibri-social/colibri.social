import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { SpaceIcon } from "../Space/SpaceIcon";

export type HostConnectedProps = {
	spaceName?: string;
	iconSrc?: string;
	account?: string;
	server?: string;
	onOpen?: () => void;
	openLabel?: string;
	appHref?: string;
	class?: string;
};

const GRANTS = [
	"Run the Space, its channels and roles",
	"Add and remove members",
	"Post messages from connected chats",
];

export const HostConnected = (props: HostConnectedProps) => (
	<div
		data-host-connected=""
		class={cx(
			"flex w-full max-w-md flex-col gap-5 rounded-surface border border-border bg-card p-6",
			props.class,
		)}
	>
		<div class="flex items-center gap-2.5">
			<CheckCircleIcon aria-hidden="true" class="size-6 text-primary" />
			<h1 class="m-0 font-bold text-foreground text-xl">
				Colibri is connected
			</h1>
		</div>
		<Show when={props.account}>
			<div class="flex items-center gap-3 rounded-control bg-secondary p-3">
				<SpaceIcon
					name={props.spaceName ?? props.account ?? ""}
					src={props.iconSrc}
					size={48}
					class="size-12 rounded-control"
				/>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="truncate font-semibold text-foreground text-base">
						{props.account}
					</span>
					<Show when={props.server}>
						<span class="truncate text-muted-foreground text-sm">
							On the server {props.server}
						</span>
					</Show>
				</div>
			</div>
		</Show>
		<div class="flex flex-col gap-2.5">
			<p class="m-0 text-muted-foreground text-sm">
				Colibri can now, for this account:
			</p>
			<ul class="m-0 flex list-none flex-col gap-2 p-0">
				<For each={GRANTS}>
					{(grant) => (
						<li class="flex items-center gap-2.5 text-foreground text-sm">
							<CheckIcon
								aria-hidden="true"
								class="size-4 shrink-0 text-muted-foreground"
							/>
							{grant}
						</li>
					)}
				</For>
			</ul>
		</div>
		<Show when={props.onOpen}>
			<Button block onClick={() => props.onOpen?.()}>
				{props.openLabel ?? "Open Colibri"}
			</Button>
		</Show>
		<Show
			when={props.appHref}
			fallback={
				<p class="m-0 text-center text-muted-foreground text-sm">
					You can also close this tab.
				</p>
			}
		>
			<p class="m-0 text-center text-muted-foreground text-sm">
				Started in the Colibri app?{" "}
				<a href={props.appHref} class="font-medium text-primary-highlight">
					Go back to the app
				</a>
			</p>
		</Show>
	</div>
);
