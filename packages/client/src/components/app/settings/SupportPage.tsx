import {
	type Component,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
import { toast } from "somoto";
import ArrowSquareOutIcon from "~icons/ph/arrow-square-out";
import HeartIcon from "~icons/ph/heart-fill";
import LinkBreakIcon from "~icons/ph/link-break";
import LinkIcon from "~icons/ph/link-simple";
import { getExternalAccountLink } from "../../../atproto/labeler-attestation";
import {
	startExternalAccountLink,
	unlinkExternalAccount,
} from "../../../atproto/labeler-link";
import { invalidateLabelerBadges } from "../../../atproto/labeler-lookup";
import { useUserContext } from "../../../contexts/User";
import { classifyThrown } from "../../../errors/classify";
import { isTauriRuntime } from "../../../notifications/environment";
import { cx } from "../../../utils/cva";
import { createLogger } from "../../../utils/logger";
import { openExternalLink } from "../../../utils/open-external-link";
import { useUserBadges } from "../../../utils/user-badges";
import { Button } from "../../ui/Button";
import { SettingsPage } from "../common/SettingsModal";
import { Avatar } from "../user/Avatar";
import { Badge } from "../user/Badge";
import { displayableNameFn } from "../user/DisplayableName";

const log = createLogger("badges");

const COLLECTIVE_URL = "https://opencollective.com/colibri-social";
const COLLECTIVE_SIGN_IN_URL = "https://opencollective.com/signin";

const SUPPORTER_VALS = [
	"sponsor-twenty-five",
	"supporter-ten",
	"backer-five",
	"donator",
];

const BACKERS_CHECKOUT =
	"https://opencollective.com/colibri-social/contribute/backers-100302/checkout";

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
		blurb: "Keep the lights on and wear a badge for it on your profile.",
		url: `${BACKERS_CHECKOUT}?interval=month&amount=5&name=&legalName=&email=`,
		highlight: false,
	},
	{
		val: "sponsor-twenty-five",
		price: "$25",
		cadence: "/ month",
		blurb: "Seriously move the needle on development.",
		url: "https://opencollective.com/colibri-social/contribute/sponsor-100710/checkout?interval=month&amount=25&name=&legalName=&email=",
		highlight: true,
	},
	{
		val: "donator",
		price: "Custom",
		cadence: "one-time",
		blurb: "Chip in any amount, whenever you like.",
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

const formatVerifiedAt = (value: string): string | undefined => {
	if (!value) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return parsed.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

export const SupportPage: Component = () => {
	const user = useUserContext();
	const { all } = useUserBadges(() => user);

	const [busy, setBusy] = createSignal(false);

	const [link, { refetch, mutate }] = createResource(
		() => user.did,
		(did) => getExternalAccountLink(did),
	);

	const earned = () => (all() ?? []).filter((v) => SUPPORTER_VALS.includes(v));
	const previewBadge = () => earned()[0] ?? "sponsor-twenty-five";

	const connect = async () => {
		setBusy(true);
		const toastId = toast.loading("Opening Open Collective...");
		try {
			const url = await startExternalAccountLink(user.atproto.agent);

			if (isTauriRuntime()) {
				toast.success("Finish up in your browser, then come back here.", {
					id: toastId,
				});
				openExternalLink(url);
			} else {
				toast.dismiss(toastId);
				window.location.assign(url);
			}
		} catch (err) {
			log.error("starting the Open Collective link failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Could not start linking. Please try again.", {
				id: toastId,
			});
		} finally {
			setBusy(false);
		}
	};

	const disconnect = async () => {
		setBusy(true);
		const toastId = toast.loading("Disconnecting...");
		try {
			const result = await unlinkExternalAccount(user.atproto.agent, user.did);
			mutate(null);
			toast.success(
				result.negatedLabelVals.length > 0
					? "Disconnected. Your supporter badge has been removed."
					: "Disconnected.",
				{ id: toastId },
			);
		} catch (err) {
			log.error("unlinking the Open Collective account failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Could not disconnect. Please try again.", { id: toastId });
		} finally {
			setBusy(false);
		}
	};

	const recheck = async () => {
		setBusy(true);
		const toastId = toast.loading("Checking Open Collective...");
		try {
			invalidateLabelerBadges(user.did);
			await refetch();
			toast.success("Up to date.", { id: toastId });
		} finally {
			setBusy(false);
		}
	};

	return (
		<SettingsPage
			loading={() => false}
			title="Support Colibri"
			description="Every contribution goes straight to the people building and running Colibri. Support us on Open Collective, link your account here, and your badge shows up next to your name across the whole app."
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
						<For each={earned()}>{(val) => <Badge val={val} size="sm" />}</For>
					</div>
				</div>
			</Show>

			<div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
				<span class="text-sm font-medium">Your Open Collective account</span>

				<Show
					when={link()}
					fallback={
						<>
							<p class="m-0 text-sm text-muted-foreground">
								Already contributing? Connect your Open Collective account and
								your badge is granted right away, then kept in step with your
								contribution.
							</p>
							<Button
								class="w-fit"
								disabled={busy() || link.loading}
								onClick={() => void connect()}
							>
								<LinkIcon />
								Connect Open Collective
							</Button>
							<p class="m-0 text-xs text-muted-foreground">
								Contributed as a guest? Guest profiles cannot sign in. Claim
								yours by signing in to Open Collective with the email you
								contributed with, then come back and connect.{" "}
								<Button
									as="a"
									href={COLLECTIVE_SIGN_IN_URL}
									target="_blank"
									rel="noreferrer"
									onClick={(e) => openExternalLink(COLLECTIVE_SIGN_IN_URL, e)}
									variant="link"
									class="h-auto p-0 text-xs"
								>
									Claim your profile
								</Button>
							</p>
						</>
					}
				>
					{(connected) => (
						<>
							<div class="flex flex-row flex-wrap items-center gap-2 text-sm">
								<span class="font-medium">
									{connected().accountSlug
										? `@${connected().accountSlug}`
										: "Connected"}
								</span>
								<Show when={formatVerifiedAt(connected().verifiedAt)}>
									{(verified) => (
										<span class="text-muted-foreground">
											verified {verified()}
										</span>
									)}
								</Show>
							</div>
							<p class="m-0 text-sm text-muted-foreground">
								Your badge follows your contribution. Change or cancel it on
								Open Collective and this catches up on its own within about
								fifteen minutes.
							</p>
							<div class="flex flex-row flex-wrap gap-2">
								<Button
									variant="secondary"
									disabled={busy()}
									onClick={() => void recheck()}
								>
									Refresh
								</Button>
								<Button
									variant="secondary"
									disabled={busy()}
									onClick={() => void disconnect()}
								>
									<LinkBreakIcon />
									Disconnect
								</Button>
							</div>
						</>
					)}
				</Show>
			</div>

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
								<Badge class="w-fit" val={tier.val} size="sm" />
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
				<p class="m-0 text-xs text-muted-foreground">
					Any monthly amount works, not just these. Whatever you give lands on
					the highest badge it reaches.
				</p>
			</div>

			<div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
				<span class="text-sm font-medium">How it looks on your profile</span>
				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<Avatar user={user} size="base" disableState />
					<span class="inline-flex min-w-0 flex-row items-center gap-2">
						<span class="truncate font-semibold">
							{displayableNameFn(user)}
						</span>
						<Badge val={previewBadge()} size="xs" />
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
