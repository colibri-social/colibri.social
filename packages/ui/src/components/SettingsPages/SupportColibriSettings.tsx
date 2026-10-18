import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { RefreshIcon } from "@solar-icons/solid/bold/refresh";
import { SquareArrowRightUpIcon } from "@solar-icons/solid/bold/square-arrow-right-up";
import { UnlinkIcon } from "@solar-icons/solid/bold/unlink";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import { Button, buttonVariants } from "../Button/Button";
import { Skeleton } from "../Skeleton/Skeleton";
import { OPEN_COLLECTIVE_SIGN_IN_URL, OPEN_COLLECTIVE_URL } from "./links";
import { SettingsField, SettingsPage } from "./shared";

export type SupportTier = {
	id: string;
	badge: JSX.Element;
	price: string;
	cadence: string;
	blurb: string;
	href: string;
	highlight?: boolean;
};

export type SupporterLink =
	| { state: "loading" }
	| { state: "none" }
	| { state: "connected"; account?: string; verifiedAt?: string };

export type SupportPreview = {
	name: string;
	seed?: string;
	avatar?: string;
	badge: JSX.Element;
};

export type SupportColibriSettingsProps = {
	earnedBadges?: JSX.Element[];
	link: SupporterLink;
	busy?: boolean;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onRefresh?: () => void;
	tiers: SupportTier[];
	preview: SupportPreview;
	onOpenLink?: (event: MouseEvent, href: string) => void;
	class?: string;
};

const PERKS = [
	"A supporter badge next to your name, everywhere on Colibri",
	"Directly fund the people building Colibri",
	"Help keep Colibri independent and run by its community",
	"Pick which badge shows if you earn more than one",
];

const linkClass =
	"rounded-control-xs font-semibold text-primary-highlight hover:underline focus-ring";

const panelClass = "flex flex-col gap-3 rounded-control bg-secondary p-4";

export const SupportColibriSettings = (props: SupportColibriSettingsProps) => {
	const earned = () => props.earnedBadges ?? [];
	const open = (href: string) => (event: MouseEvent) =>
		props.onOpenLink?.(event, href);

	return (
		<SettingsPage
			class={props.class}
			intro="Every contribution goes straight to the people building and running Colibri. Support us on Open Collective, connect your account here, and your badge shows up next to your name across the whole app."
		>
			<Show when={earned().length > 0}>
				<section
					aria-label="Your supporter badges"
					class="flex flex-col gap-3 rounded-control border border-primary/40 bg-primary/10 p-4"
				>
					<span class="flex items-center gap-2 text-sm font-semibold text-foreground">
						<HeartIcon class="size-5 text-primary-highlight" />
						Thank you for supporting Colibri!
					</span>
					<p class="text-sm text-muted-foreground">
						Your contribution keeps this project alive. Here's what you're
						wearing right now:
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<For each={earned()}>{(badge) => badge}</For>
					</div>
				</section>
			</Show>

			<SettingsField label="Your Open Collective account">
				<div class={panelClass} data-supporter-link={props.link.state}>
					<Switch>
						<Match when={props.link.state === "loading"}>
							<Skeleton class="h-4 w-2/3" />
							<Skeleton class="h-9 w-48" />
						</Match>
						<Match when={props.link.state === "none"}>
							<p class="text-sm text-muted-foreground">
								Already contributing? Connect your Open Collective account and
								you get your badge right away. It stays in step with your
								contribution from then on.
							</p>
							<Button
								class="w-full @min-[480px]/settings:w-fit"
								icon={<LinkIcon />}
								loading={props.busy}
								onClick={() => props.onConnect?.()}
							>
								Connect Open Collective
							</Button>
							<p class="text-xs text-muted-foreground">
								Contributed as a guest? Guest profiles can't sign in. Sign in to
								Open Collective with the email you contributed with to claim
								your profile, then come back and connect.{" "}
								<a
									href={OPEN_COLLECTIVE_SIGN_IN_URL}
									target="_blank"
									rel="noreferrer"
									onClick={open(OPEN_COLLECTIVE_SIGN_IN_URL)}
									class={linkClass}
								>
									Claim your profile
								</a>
							</p>
						</Match>
						<Match when={props.link.state === "connected" && props.link}>
							{(connected) => (
								<>
									<div class="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
										<span class="truncate font-semibold text-foreground">
											{connected().account
												? `@${connected().account}`
												: "Connected"}
										</span>
										<Show when={connected().verifiedAt}>
											{(verified) => (
												<span class="text-muted-foreground">
													Checked {verified()}
												</span>
											)}
										</Show>
									</div>
									<p class="text-sm text-muted-foreground">
										Your badge follows your contribution. If you change or
										cancel it on Open Collective, this catches up on its own
										within about fifteen minutes.
									</p>
									<div class="flex flex-wrap gap-2">
										<Button
											variant="secondary"
											icon={<RefreshIcon />}
											disabled={props.busy}
											onClick={() => props.onRefresh?.()}
										>
											Check again
										</Button>
										<Button
											variant="destructive-subtle"
											icon={<UnlinkIcon />}
											disabled={props.busy}
											onClick={() => props.onDisconnect?.()}
										>
											Disconnect
										</Button>
									</div>
								</>
							)}
						</Match>
					</Switch>
				</div>
			</SettingsField>

			<SettingsField label="Choose how you support">
				<div class="grid grid-cols-1 gap-3 @min-[640px]/settings:grid-cols-3">
					<For each={props.tiers}>
						{(tier) => (
							<div
								data-support-tier={tier.id}
								data-highlight={tier.highlight || undefined}
								class={cx(
									"flex min-w-0 flex-col gap-3 rounded-control border bg-secondary p-4",
									tier.highlight
										? "border-primary ring-1 ring-primary/40"
										: "border-border",
								)}
							>
								<div class="flex">{tier.badge}</div>
								<div class="flex items-baseline gap-1">
									<span class="text-2xl leading-none font-bold text-foreground tabular-nums">
										{tier.price}
									</span>
									<span class="text-sm text-muted-foreground">
										{tier.cadence}
									</span>
								</div>
								<p class="flex-1 text-sm text-muted-foreground">{tier.blurb}</p>
								<a
									href={tier.href}
									target="_blank"
									rel="noreferrer"
									onClick={open(tier.href)}
									class={cx(
										buttonVariants({
											variant: tier.highlight ? "primary" : "secondary",
											block: true,
										}),
									)}
								>
									Contribute
									<SquareArrowRightUpIcon class="size-4" />
								</a>
							</div>
						)}
					</For>
				</div>
				<p class="text-xs text-muted-foreground">
					Any monthly amount works, not just these. You get the highest badge
					your contribution reaches.
				</p>
			</SettingsField>

			<SettingsField label="How it looks on your profile">
				<div class={panelClass}>
					<div class="flex min-w-0 items-center gap-3">
						<Avatar
							size="base"
							name={props.preview.name}
							src={props.preview.avatar}
							seed={props.preview.seed}
						/>
						<span class="inline-flex min-w-0 items-center gap-2">
							<span class="truncate text-base font-semibold text-foreground">
								{props.preview.name}
							</span>
							<span class="shrink-0">{props.preview.badge}</span>
						</span>
					</div>
				</div>
			</SettingsField>

			<SettingsField label="Everything you get">
				<ul class="flex flex-col gap-2">
					<For each={PERKS}>
						{(perk) => (
							<li class="flex items-start gap-2 text-sm text-muted-foreground">
								<HeartIcon class="mt-0.5 size-4 shrink-0 text-primary-highlight" />
								<span>{perk}</span>
							</li>
						)}
					</For>
				</ul>
			</SettingsField>

			<a
				href={OPEN_COLLECTIVE_URL}
				target="_blank"
				rel="noreferrer"
				onClick={open(OPEN_COLLECTIVE_URL)}
				class={cx(linkClass, "inline-flex w-fit items-center gap-1 text-sm")}
			>
				View Colibri on Open Collective
				<SquareArrowRightUpIcon class="size-4" />
			</a>
		</SettingsPage>
	);
};
