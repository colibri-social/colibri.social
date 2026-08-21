import { logoUrl as ColibriLogo } from "@colibri-social/assets";
import {
	type Component,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import ArrowUpRightIcon from "~icons/ph/arrow-up-right";
import CaretLeftIcon from "~icons/ph/caret-left";
import CaretRightIcon from "~icons/ph/caret-right";
import CheckIcon from "~icons/ph/check";
import GlobeIcon from "~icons/ph/globe-simple";
import ShieldCheckIcon from "~icons/ph/shield-check";
import type { ActorTypeaheadResult } from "../../atproto/xrpc/app/bsky/actor/searchActorsTypeahead";
import { useViewport } from "../../contexts/Viewport";
import { isTauriRuntime } from "../../notifications/environment";
import { openExternalLink } from "../../utils/open-external-link";
import { Spinner } from "../icons/Spinner";
import { Button } from "../ui/Button";
import {
	Search,
	SearchContent,
	SearchControl,
	SearchItem,
	SearchItemDescription,
	SearchItemLabel,
	SearchListbox,
	SearchNoResult,
	SearchPortal,
} from "../ui/Search";
import type { SignInFlow } from "./createSignInFlow";
import {
	badgeBg,
	badgeBorder,
	FLAGS,
	PROVIDER_DIRECTORY_URL,
	PROVIDERS,
	REGION_LABEL,
	REGIONS,
	type Region,
	SELF_HOSTING_URL,
} from "./providers";

const openExternal = (url: string) => {
	if (isTauriRuntime()) {
		openExternalLink(url);
		return;
	}
	window.open(url, "_blank", "noopener,noreferrer");
};

const initials = (name: string): string =>
	name
		.replace(/^@/, "")
		.split(/[\s.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");

const AccountAvatar: Component<{
	avatar?: string;
	name: string;
	class?: string;
}> = (props) => (
	<Show
		when={props.avatar}
		fallback={
			<span
				class={`grid shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary ${props.class ?? "size-10 text-sm"}`}
			>
				{initials(props.name)}
			</span>
		}
	>
		{(src) => (
			<img
				src={src()}
				alt=""
				loading="lazy"
				class={`shrink-0 rounded-full bg-muted object-cover ${props.class ?? "size-10"}`}
			/>
		)}
	</Show>
);

const HopTile: Component<{
	label: string;
	src?: string;
	fallback?: "globe" | "check";
}> = (props) => {
	const [failed, setFailed] = createSignal(false);

	return (
		<div class="flex min-w-0 flex-col items-center gap-2 text-center">
			<span
				class="grid size-13 shrink-0 place-items-center rounded-2xl border border-border bg-neutral-900"
				classList={{
					"border-primary/40 bg-primary/15 text-primary":
						props.fallback === "check",
				}}
			>
				<Show
					when={props.src && !failed()}
					fallback={
						<Show
							when={props.fallback === "check"}
							fallback={<GlobeIcon class="size-6 text-muted-foreground" />}
						>
							<CheckIcon class="size-6" />
						</Show>
					}
				>
					<img
						src={props.src}
						alt=""
						class="size-7 object-contain"
						onError={() => setFailed(true)}
					/>
				</Show>
			</span>
			<small class="max-w-20 wrap-anywhere text-xs leading-tight text-muted-foreground">
				{props.label}
			</small>
		</div>
	);
};

const Wire: Component = () => (
	<span class="signin-wire mt-6.5 h-0.5 min-w-4 flex-1 rounded-full bg-border" />
);

export const SignInSteps: Component<{ flow: SignInFlow }> = (props) => {
	const flow = props.flow;
	const viewport = useViewport();
	const [region, setRegion] = createSignal<"any" | Region>("any");

	const filteredProviders = () =>
		PROVIDERS.filter(
			(provider) => region() === "any" || provider.region === region(),
		);

	const isPending = (id: string) => flow.busy() && flow.provider()?.id === id;

	const keyboardVisible = () => {
		const height = viewport.height();
		return (
			height !== undefined &&
			typeof window !== "undefined" &&
			window.innerHeight - height > 100
		);
	};

	const dropdownMaxHeight = () => {
		const height = viewport.height();
		return height === undefined ? undefined : `${Math.max(height - 32, 120)}px`;
	};

	const targetLabel = () => flow.target()?.host ?? "your provider";

	const heading = () => {
		switch (flow.step()) {
			case "handle":
				return "What is your handle?";
			case "confirm":
				return "Is this you?";
			case "provider":
				return "Pick a home for your account";
			default:
				return `Taking you to ${targetLabel()}`;
		}
	};

	return (
		<div class="flex w-full flex-col gap-5">
			<div class="flex items-center gap-3">
				<Show when={flow.canGoBack()}>
					<Button
						variant="ghost"
						size="icon-sm"
						class="rounded-full"
						aria-label="Back"
						onClick={() => flow.back()}
					>
						<CaretLeftIcon />
					</Button>
				</Show>
				<div class="flex max-w-40 flex-1 gap-1.5" aria-hidden="true">
					<For each={Array.from({ length: flow.stepCount() })}>
						{(_, index) => (
							<span
								class="h-0.75 flex-1 rounded-full transition-colors duration-300"
								classList={{
									"bg-primary": index() + 1 <= flow.stepIndex(),
									"bg-border": index() + 1 > flow.stepIndex(),
								}}
							/>
						)}
					</For>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<p class="m-0 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-primary">
					Step {flow.stepIndex()} of {flow.stepCount()}
				</p>
				<h2 class="m-0 font-display text-3xl leading-[1.06] text-balance wrap-anywhere text-foreground xl:text-4xl">
					{heading()}
				</h2>
			</div>

			<Switch>
				<Match when={flow.step() === "handle"}>
					<p class="m-0 text-sm text-muted-foreground">
						Sign in with the ATmosphere account you already have. Colibri never
						sees your password.
					</p>

					<Search<ActorTypeaheadResult>
						options={flow.options()}
						debounceOptionsMillisecond={250}
						triggerMode="input"
						optionValue="did"
						optionLabel="handle"
						placeholder="alice.bsky.social"
						placement={keyboardVisible() ? "top-start" : "bottom-start"}
						onInputChange={flow.onHandleInput}
						onChange={(picked) => picked && flow.pickAccount(picked)}
						itemComponent={(itemProps) => (
							<SearchItem
								item={itemProps.item}
								class="first-of-type:mt-0 last-of-type:mb-0"
							>
								<div class="flex items-center gap-2">
									<AccountAvatar
										avatar={itemProps.item.rawValue.avatar}
										name={
											itemProps.item.rawValue.displayName ??
											itemProps.item.rawValue.handle
										}
										class="size-6 text-[0.6rem]"
									/>
									<div class="flex min-w-0 flex-col">
										<SearchItemLabel class="truncate text-sm">
											{itemProps.item.rawValue.displayName ??
												itemProps.item.rawValue.handle}
										</SearchItemLabel>
										<SearchItemDescription class="truncate text-xs">
											@{itemProps.item.rawValue.handle}
										</SearchItemDescription>
									</div>
								</div>
							</SearchItem>
						)}
					>
						<SearchControl
							aria-label="Handle"
							inputProps={{
								autocapitalize: "none",
								autocorrect: "off",
								autocomplete: "username",
								spellcheck: false,
								onKeyDown: (event: KeyboardEvent) => {
									if (event.key === "Enter") flow.submitHandle();
								},
							}}
						/>
						<SearchPortal>
							<SearchContent style={{ "max-height": dropdownMaxHeight() }}>
								<SearchListbox class="m-0" />
								<SearchNoResult>No accounts found.</SearchNoResult>
							</SearchContent>
						</SearchPortal>
					</Search>
				</Match>

				<Match when={flow.step() === "confirm"}>
					<Show when={flow.identity()}>
						{(account) => (
							<div class="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
								<AccountAvatar
									avatar={account().avatar}
									name={account().displayName ?? account().handle}
									class="size-14 text-lg"
								/>
								<span class="flex min-w-0 flex-col">
									<span class="truncate text-lg font-bold">
										{account().displayName ?? account().handle}
									</span>
									<span class="truncate text-sm text-muted-foreground">
										@{account().handle}
									</span>
								</span>
							</div>
						)}
					</Show>
					<p class="m-0 text-sm text-muted-foreground">
						Next you will approve Colibri with your provider, then land right
						back here.
					</p>
				</Match>

				<Match when={flow.step() === "provider"}>
					<p class="m-0 text-sm text-muted-foreground">
						Your provider stores your account and your data. You can move it
						somewhere else later without losing anything.
					</p>

					<div class="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
						<span class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
							Choose a provider
						</span>
						<div
							class="inline-flex gap-0.5 rounded-full border border-border bg-muted p-0.5"
							role="tablist"
							aria-label="Filter by data location"
						>
							<For each={REGIONS}>
								{(entry) => (
									<button
										type="button"
										role="tab"
										aria-selected={region() === entry.value}
										class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
										classList={{
											"bg-primary text-primary-foreground":
												region() === entry.value,
											"text-muted-foreground hover:text-foreground":
												region() !== entry.value,
										}}
										onClick={() => setRegion(entry.value)}
									>
										<Show when={entry.region}>
											{(value) => (
												<img
													src={FLAGS[value()]}
													alt=""
													class="h-3.5 w-auto rounded-[1px]"
												/>
											)}
										</Show>
										{entry.label}
									</button>
								)}
							</For>
						</div>
					</div>

					<div class="flex w-full flex-col gap-2">
						<For each={filteredProviders()}>
							{(p) => (
								<button
									type="button"
									class={`relative flex w-full cursor-pointer flex-col gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-background/20 disabled:cursor-default disabled:opacity-70 sm:flex-row sm:items-center sm:gap-3.5 ${
										p.badge && `${badgeBorder[p.badge.tone]} not-first:mt-1.5`
									}`}
									disabled={flow.busy()}
									onClick={() => flow.chooseProvider(p)}
								>
									<Show when={p.badge}>
										{(b) => (
											<span
												class={`absolute -top-2 left-1/2 flex h-4 w-24 -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-sm border px-1.5 text-[0.6rem] font-bold uppercase tracking-wider sm:-top-px sm:rounded-t-none sm:rounded-b-sm ${badgeBorder[b().tone]} ${badgeBg[b().tone]}`}
											>
												{b().label}
											</span>
										)}
									</Show>

									<div class="flex w-full items-center gap-3 sm:w-auto sm:contents">
										<span class="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-neutral-900 p-1.5">
											<img
												src={p.logo}
												alt=""
												class="max-h-full max-w-full object-contain"
											/>
										</span>
										<span class="ml-auto sm:hidden">
											<Show
												when={isPending(p.id)}
												fallback={
													<CaretRightIcon class="size-5 text-muted-foreground" />
												}
											>
												<Spinner className="size-5" />
											</Show>
										</span>
									</div>
									<span class="flex min-w-0 flex-1 flex-col gap-0.5">
										<span class="flex items-center gap-2 text-sm font-bold">
											<img
												src={FLAGS[p.region]}
												alt={REGION_LABEL[p.region]}
												class="h-4 w-auto shrink-0 rounded-[2px]"
											/>
											{p.name}
										</span>
										<span class="text-xs text-muted-foreground sm:truncate">
											{p.desc}
										</span>
									</span>
									<Show
										when={isPending(p.id)}
										fallback={
											<CaretRightIcon class="hidden size-5 shrink-0 text-muted-foreground sm:block" />
										}
									>
										<Spinner className="hidden size-5 shrink-0 sm:block" />
									</Show>
								</button>
							)}
						</For>
					</div>

					<div class="flex flex-col gap-2 sm:flex-row">
						<Button
							variant="outline"
							class="flex-1"
							onClick={() => openExternal(PROVIDER_DIRECTORY_URL)}
						>
							Browse all providers
							<ArrowUpRightIcon />
						</Button>
						<Button
							variant="outline"
							class="flex-1"
							onClick={() => openExternal(SELF_HOSTING_URL)}
						>
							Run your own
							<ArrowUpRightIcon />
						</Button>
					</div>
				</Match>

				<Match when={flow.step() === "handoff"}>
					<div class="-mx-1 overflow-x-auto px-1 py-1">
						<div class="flex min-w-fit items-start justify-center gap-2">
							<HopTile label="Colibri" src={ColibriLogo} />
							<Wire />
							<HopTile label={targetLabel()} src={flow.target()?.icon} />
							<Wire />
							<HopTile label="back here" fallback="check" />
						</div>
					</div>
					<div class="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
						<ShieldCheckIcon class="mt-0.5 size-5 shrink-0 text-primary" />
						<p class="m-0">
							Your provider asks you to approve Colibri, then sends you straight
							back.{" "}
							<span class="font-semibold text-foreground">
								Your password stays with them.
							</span>{" "}
							You can revoke access there at any time.
						</p>
					</div>
				</Match>
			</Switch>

			<div class="flex flex-col gap-1.5">
				<Switch>
					<Match when={flow.step() === "handle"}>
						<Button
							class="w-full"
							size="lg"
							aria-busy={flow.busy()}
							disabled={flow.busy()}
							onClick={() => flow.submitHandle()}
						>
							<Show when={flow.busy()}>
								<Spinner className="size-4" />
							</Show>
							Continue
						</Button>
					</Match>
					<Match when={flow.step() === "confirm"}>
						<Button
							class="w-full"
							size="lg"
							aria-busy={flow.busy()}
							disabled={flow.busy()}
							onClick={() => flow.confirmIdentity()}
						>
							<Show when={flow.busy()}>
								<Spinner className="size-4" />
							</Show>
							Yes
						</Button>
						<Button
							variant="ghost"
							class="w-full text-muted-foreground"
							onClick={() => flow.back()}
						>
							No, that's not me
						</Button>
					</Match>
					<Match when={flow.step() === "handoff"}>
						<Button
							class="h-auto min-h-10 w-full whitespace-normal wrap-anywhere py-2 text-center"
							size="lg"
							aria-busy={flow.busy()}
							disabled={flow.busy()}
							onClick={() => flow.openProvider()}
						>
							<Show when={flow.busy()}>
								<Spinner className="size-4" />
							</Show>
							Open {targetLabel()}
						</Button>
						<Button
							variant="ghost"
							class="w-full text-muted-foreground"
							onClick={() => flow.back()}
						>
							Cancel
						</Button>
					</Match>
				</Switch>

				<Show when={flow.step() === "handle" || flow.step() === "provider"}>
					<p class="m-0 text-center text-sm text-muted-foreground">
						<Show
							when={flow.mode() === "signin"}
							fallback={
								<>
									Already have an account?{" "}
									<button
										type="button"
										class="cursor-pointer text-primary hover:underline"
										onClick={() => flow.switchMode("signin")}
									>
										Sign in
									</button>
								</>
							}
						>
							New to the ATmosphere?{" "}
							<button
								type="button"
								class="cursor-pointer text-primary hover:underline"
								onClick={() => flow.switchMode("signup")}
							>
								Create an account
							</button>
						</Show>
					</p>
				</Show>
			</div>
		</div>
	);
};
