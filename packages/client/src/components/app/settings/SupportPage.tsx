import { type Component, For, Show } from "solid-js";
import ArrowSquareOutIcon from "~icons/ph/arrow-square-out";
import HeartIcon from "~icons/ph/heart-fill";
import { useUserContext } from "../../../contexts/User";
import { cx } from "../../../utils/cva";
import { openExternalLink } from "../../../utils/open-external-link";
import { badgeText, useUserBadges } from "../../../utils/user-badges";
import { Button } from "../../ui/Button";
import { SettingsPage } from "../common/SettingsModal";
import { Avatar } from "../user/Avatar";
import { Badge } from "../user/Badge";
import { displayableNameFn } from "../user/DisplayableName";

const COLLECTIVE_URL = "https://opencollective.com/colibri-social";

const SUPPORTER_VALS = ["sponsor-twenty-five", "backer-five", "donator"];

type Tier = {
	val: string;
	price: string;
	cadence: string;
	blurb: string;
	url: string;
	highlight: boolean;
};

const TIERS: Tier[] = [
	{
		val: "backer-five",
		price: "$5",
		cadence: "/ month",
		blurb:
			"Keep the lights on and get the lime $5 Backer badge on your profile.",
		url: "https://opencollective.com/colibri-social/contribute/backers-100302/checkout?interval=month&amount=5&name=&legalName=&email=",
		highlight: false,
	},
	{
		val: "sponsor-twenty-five",
		price: "$25",
		cadence: "/ month",
		blurb:
			"Seriously move the needle on development and wear the teal $25 Sponsor badge.",
		url: "https://opencollective.com/colibri-social/contribute/sponsor-100710/checkout?interval=month&amount=25&name=&legalName=&email=",
		highlight: true,
	},
	{
		val: "donator",
		price: "Custom",
		cadence: "one-time",
		blurb:
			"Chip in any amount, whenever you like, and earn the fuchsia Donator badge.",
		url: "https://opencollective.com/colibri-social/donate?interval=oneTime&amount=20&name=&legalName=&email=",
		highlight: false,
	},
];

const PERKS = [
	"A custom supporter badge next to your name, everywhere on Colibri",
	"Directly fund the people building your favourite client",
	"Help keep Colibri independent and community-run",
	"Choose which badge shows in Preferences if you earn more than one",
];

export const SupportPage: Component = () => {
	const user = useUserContext();
	const { all } = useUserBadges(() => user);

	const earned = () => (all() ?? []).filter((v) => SUPPORTER_VALS.includes(v));
	const previewBadge = () => earned()[0] ?? "sponsor-twenty-five";

	return (
		<SettingsPage
			loading={() => false}
			title="Support Colibri"
			description="Every contribution goes straight to the people building and running Colibri. Support us on Open Collective and you'll get a custom badge that shows up next to your name across the whole app."
		>
			<Show when={earned().length > 0}>
				<div class="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
					<div class="flex items-center gap-2 text-sm font-semibold text-foreground">
						<HeartIcon class="text-primary" />
						<span>Thank you for supporting Colibri!</span>
					</div>
					<p class="m-0 text-sm text-muted-foreground">
						Your contribution keeps this project alive. Here's what you're
						currently rocking:
					</p>
					<div class="flex flex-row flex-wrap items-center gap-2">
						<For each={earned()}>
							{(val) => <Badge text={badgeText(val)} size="sm" style={val} />}
						</For>
					</div>
				</div>
			</Show>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Choose how you support</span>
				<div class="grid grid-cols-1 gap-3">
					<For each={TIERS}>
						{(tier) => (
							<div
								class={cx(
									"flex flex-col gap-3 rounded-xl border bg-card p-4",
									tier.highlight
										? "border-primary ring-1 ring-primary/40"
										: "border-border",
								)}
							>
								<Badge
									class="w-fit"
									text={badgeText(tier.val)}
									size="sm"
									style={tier.val}
								/>
								<div class="flex items-baseline gap-1">
									<span class="text-2xl font-bold leading-none">
										{tier.price}
									</span>
									<span class="text-sm text-muted-foreground">
										{tier.cadence}
									</span>
								</div>
								<p class="m-0 flex-1 text-sm text-muted-foreground">
									{tier.blurb}
								</p>
								<Button
									as="a"
									href={tier.url}
									target="_blank"
									rel="noreferrer"
									onClick={(e) => openExternalLink(tier.url, e)}
									variant={tier.highlight ? "default" : "secondary"}
									class="w-full"
								>
									Contribute
									<ArrowSquareOutIcon />
								</Button>
							</div>
						)}
					</For>
				</div>
			</div>

			<div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
				<span class="text-sm font-medium">How it looks on your profile</span>
				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<Avatar user={user} size="base" disableState />
					<span class="inline-flex min-w-0 flex-row items-center gap-2">
						<span class="truncate font-semibold">
							{displayableNameFn(user)}
						</span>
						<Badge
							text={badgeText(previewBadge())}
							size="xs"
							style={previewBadge()}
						/>
					</span>
				</div>
				<p class="m-0 text-xs text-muted-foreground">
					Hover any badge to see what it stands for. Earn more than one? Pick
					your favourite under Preferences.
				</p>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Everything you get</span>
				<ul class="m-0 flex flex-col gap-2 pl-0">
					<For each={PERKS}>
						{(perk) => (
							<li class="flex list-none items-start gap-2 text-sm text-muted-foreground">
								<HeartIcon class="mt-0.5 shrink-0 text-primary" />
								<span>{perk}</span>
							</li>
						)}
					</For>
				</ul>
			</div>

			<Button
				as="a"
				href={COLLECTIVE_URL}
				target="_blank"
				rel="noreferrer"
				onClick={(e) => openExternalLink(COLLECTIVE_URL, e)}
				variant="link"
				class="w-fit px-0"
			>
				View the collective on Open Collective
				<ArrowSquareOutIcon />
			</Button>
		</SettingsPage>
	);
};
