import { useNavigate } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	Show,
} from "solid-js";
import { toast } from "somoto";
import ArrowUpRightIcon from "~icons/ph/arrow-up-right";
import CaretRightIcon from "~icons/ph/caret-right";
import { startOAuthSignIn } from "../atproto/auth";
import { buildScopes } from "../atproto/scopes";
import { useAuthContext } from "../contexts/Auth";
import { getAppViewDid } from "../utils/appview";
import { Spinner } from "./icons/Spinner";
import { Button } from "./ui/Button";

type Region = "eu" | "us";

const FLAGS: Record<Region, string> = {
	eu: "/flags/eu.svg",
	us: "/flags/us.svg",
};

const REGION_LABEL: Record<Region, string> = {
	eu: "EU",
	us: "US",
};

type Provider = {
	id: string;
	name: string;
	logo: string;
	host: string;
	region: Region;
	badge?: { label: string; tone: "rec" | "pop" };
	desc: string;
};

const PROVIDERS: Array<Provider> = [
	{
		id: "eurosky",
		name: "Eurosky",
		logo: "/login/eurosky.svg",
		host: "eurosky.social",
		region: "eu",
		badge: { label: "Recommended", tone: "rec" },
		desc: "A European initiative for sovereign social web infrastructure.",
	},
	{
		id: "bsky",
		name: "Bluesky",
		logo: "/login/bluesky.svg",
		host: "bsky.social",
		region: "us",
		badge: { label: "Most popular", tone: "pop" },
		desc: "The largest, most established provider on the network.",
	},
	{
		id: "blacksky",
		name: "Blacksky",
		logo: "/login/blacksky.svg",
		host: "blacksky.app",
		region: "us",
		desc: "Community-run, culture-first hosting.",
	},
	{
		id: "npmx",
		name: "NPMX",
		logo: "/login/npmx.svg",
		host: "npmx.social",
		region: "eu",
		desc: "The official AT Protocol Personal Data Server (PDS) for the npmx community.",
	},
];

const REGIONS: Array<{
	value: "any" | Region;
	label: string;
	region?: Region;
}> = [
	{ value: "any", label: "All" },
	{ value: "eu", label: "EU", region: "eu" },
	{ value: "us", label: "US", region: "us" },
];

const badgeBorder: Record<"rec" | "pop", string> = {
	rec: "border-primary",
	pop: "border-amber-400",
};

const badgeBg: Record<"rec" | "pop", string> = {
	rec: "sm:bg-primary/25 bg-primary text-foreground",
	pop: "sm:bg-amber-400/25 bg-amber-400 sm:text-foreground text-background",
};

export const RegisterScreen: Component = () => {
	const auth = useAuthContext();
	const navigate = useNavigate();

	const [region, setRegion] = createSignal<"any" | Region>("any");
	const [pending, setPending] = createSignal<string | null>(null);

	const filtered = () =>
		PROVIDERS.filter((p) => region() === "any" || p.region === region());

	const signUp = async (provider: Provider) => {
		if (pending() || !auth) return;

		setPending(provider.id);

		try {
			await startOAuthSignIn(auth.client, `https://${provider.host}`, {
				scope: buildScopes(getAppViewDid()).join(" "),
				prompt: "create",
			});
		} catch (err) {
			console.error(err);
			toast.error(err as any);
			setPending(null);
		}
	};

	createEffect(() => {
		if (auth?.loggedIn) navigate("/app");
	});

	return (
		<section class="pt-[min(10rem,12vh)] pb-8 mx-auto w-full max-w-336 md:px-16 px-6 relative flex flex-col items-center gap-8 min-h-screen animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
			<div class="flex flex-col gap-4 items-center text-center">
				<small class="text-primary text-sm">Join Colibri.</small>
				<h1 class="text-5xl font-black m-0">CREATE ACCOUNT</h1>
				<p class="m-0 text-muted-foreground max-w-xl">
					Pick a home for your account. You'll finish signing up with your
					provider.
				</p>
			</div>

			<div class="flex flex-col bg-card w-full max-w-xl rounded-2xl border border-border h-fit relative items-center drop-shadow-black/25 drop-shadow-2xl overflow-hidden">
				<div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4 w-full p-5 pb-4">
					<span class="text-xs tracking-[0.12em] font-semibold uppercase text-muted-foreground">
						Choose a provider
					</span>
					<div
						class="inline-flex gap-0.5 p-0.5 bg-muted border border-border rounded-full"
						role="tablist"
						aria-label="Filter by data location"
					>
						<For each={REGIONS}>
							{(r) => (
								<button
									type="button"
									role="tab"
									aria-selected={region() === r.value}
									class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
									classList={{
										"bg-primary text-primary-foreground": region() === r.value,
										"text-muted-foreground hover:text-foreground":
											region() !== r.value,
									}}
									onClick={() => setRegion(r.value)}
								>
									<Show when={r.region}>
										{(reg) => (
											<img
												src={FLAGS[reg()]}
												alt=""
												class="h-3.5 w-auto rounded-[1px]"
											/>
										)}
									</Show>
									{r.label}
								</button>
							)}
						</For>
					</div>
				</div>

				<div class="flex flex-col gap-2 w-full px-5">
					<For each={filtered()}>
						{(p) => (
							<button
								type="button"
								class={`relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 w-full text-left border rounded-lg bg-background p-4 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-70 hover:bg-background/20 ${
									p.badge && `${badgeBorder[p.badge.tone]} not-first:mt-1.5`
								}`}
								disabled={pending() !== null}
								onClick={() => signUp(p)}
							>
								<Show when={p.badge}>
									{(b) => (
										<span
											class={`absolute -top-2 left-1/2 -translate-x-1/2 sm:-top-px px-1.5 border rounded-sm sm:rounded-t-none sm:rounded-b-sm text-[0.6rem] h-4 flex items-center justify-center whitespace-nowrap w-24 font-bold uppercase tracking-wider ${badgeBorder[b().tone]} ${badgeBg[b().tone]}`}
										>
											{b().label}
										</span>
									)}
								</Show>

								<div class="flex items-center gap-3 w-full sm:w-auto sm:contents">
									<span class="size-10 shrink-0 rounded-lg border border-border bg-card p-1.5 grid place-items-center">
										<img
											src={p.logo}
											alt=""
											class="max-w-full max-h-full object-contain"
										/>
									</span>
									<span class="ml-auto sm:hidden">
										<Show
											when={pending() === p.id}
											fallback={
												<CaretRightIcon class="size-5 text-muted-foreground" />
											}
										>
											<Spinner className="size-5" />
										</Show>
									</span>
								</div>
								<span class="flex-1 min-w-0 flex flex-col gap-0.5">
									<span class="font-bold text-sm flex items-center gap-2">
										<img
											src={FLAGS[p.region]}
											alt={REGION_LABEL[p.region]}
											class="h-4 w-auto rounded-[2px] shrink-0"
										/>
										{p.name}
									</span>
									<span class="text-xs text-muted-foreground sm:truncate">
										{p.desc}
									</span>
								</span>
								<Show
									when={pending() === p.id}
									fallback={
										<CaretRightIcon class="hidden sm:block size-5 shrink-0 text-muted-foreground" />
									}
								>
									<Spinner className="hidden sm:block size-5 shrink-0" />
								</Show>
							</button>
						)}
					</For>
				</div>

				<div class="flex flex-col sm:flex-row gap-2 w-full p-5 pt-4">
					<Button
						as="a"
						variant="outline"
						class="flex-1"
						href="https://atmosphereaccount.com/hosts"
						target="_blank"
						rel="noreferrer"
					>
						Browse all providers
						<ArrowUpRightIcon />
					</Button>
					<Button
						as="a"
						variant="outline"
						class="flex-1"
						href="https://atproto.com/guides/self-hosting"
						target="_blank"
						rel="noreferrer"
					>
						Run your own
						<ArrowUpRightIcon />
					</Button>
				</div>

				<div class="relative w-full mt-2">
					<hr class="bg-border w-full h-px border-none m-0" />
					<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2 whitespace-nowrap">
						ALREADY HAVE AN ACCOUNT?
					</small>
				</div>
				<div class="w-full p-6">
					<Button
						variant="secondary"
						class="w-full"
						onClick={() => navigate("/app/login")}
					>
						Sign in
					</Button>
				</div>
			</div>

			<div class="flex flex-row items-center justify-center text-muted-foreground w-full max-w-xl gap-4 text-sm flex-wrap">
				<span>Open source</span>
				<span class="w-1 h-1 rounded-full bg-muted-foreground"></span>
				<span>EU-based</span>
				<span class="w-1 h-1 rounded-full bg-muted-foreground"></span>
				<span>Powered by AT Protocol</span>
				<span class="w-1 h-1 rounded-full bg-muted-foreground"></span>
				<span>100% Free</span>
			</div>
		</section>
	);
};
