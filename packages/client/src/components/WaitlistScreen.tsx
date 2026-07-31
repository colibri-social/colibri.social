import { Agent } from "@atproto/api";
import {
	BrowserOAuthClient,
	type OAuthSession,
} from "@atproto/oauth-client-browser";
import { useNavigate } from "@solidjs/router";
import { type Component, createSignal, onMount, Show } from "solid-js";
import { toast } from "somoto";
import { isAllowedDid } from "../atproto/allowlist";
import {
	type ActorTypeaheadResult,
	searchActorsTypeahead,
} from "../atproto/xrpc/app/bsky/actor/searchActorsTypeahead";
import { useViewport, ViewportProvider } from "../contexts/Viewport";
import { describeError } from "../errors/copy";
import { isTauriRuntime } from "../notifications/environment";
import { getAppViewHost } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { AppLoadingScreen } from "./AppLoadingScreen";
import { Spinner } from "./icons/Spinner";
import { Button } from "./ui/Button";
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
} from "./ui/Search";

const log = createLogger("waitlist");

const WAITLIST_SCOPE = "atproto transition:email";

const WEB_ORIGIN =
	(typeof window !== "undefined" &&
		(window as { __COLIBRI_WEB_ORIGIN__?: string }).__COLIBRI_WEB_ORIGIN__) ||
	"https://colibri.social";

type Phase = "idle" | "connecting" | "returning" | "done" | "error";

const isLocal = () =>
	typeof window !== "undefined" &&
	["localhost", "127.0.0.1"].includes(window.location.hostname);

const waitlistClientId = () => {
	if (isLocal()) {
		return `http://localhost?${new URLSearchParams({
			scope: WAITLIST_SCOPE,
			redirect_uri: `http://127.0.0.1:${window.location.port}/app/waitlist`,
		})}`;
	}
	return `https://${window.location.host}/oauth-client-metadata-waitlist.json`;
};

const readCallbackParams = (): URLSearchParams => {
	const raw = window.location.hash.startsWith("#")
		? window.location.hash.slice(1)
		: window.location.search.slice(1);
	return new URLSearchParams(raw);
};

export const WAITLIST_JOINED_KEY = "colibri:waitlist-joined";

export const hasJoinedWaitlist = (): boolean => {
	try {
		return !!localStorage.getItem(WAITLIST_JOINED_KEY);
	} catch {
		return false;
	}
};

export const WaitlistScreen: Component = () => {
	return (
		<ViewportProvider>
			<WaitlistScreenContent />
		</ViewportProvider>
	);
};

const WaitlistScreenContent: Component = () => {
	const navigate = useNavigate();
	const viewport = useViewport();
	const [handle, setHandle] = createSignal("");
	const [missingHandle, setMissingHandle] = createSignal(false);
	const [phase, setPhase] = createSignal<Phase>("idle");
	const [alreadyJoined, setAlreadyJoined] = createSignal(false);
	const [errorMessage, setErrorMessage] = createSignal("");
	const [options, setOptions] = createSignal<Array<ActorTypeaheadResult>>([]);

	let client: BrowserOAuthClient | undefined;
	let suggestController: AbortController | undefined;

	const keyboardVisible = () => {
		const h = viewport.height();
		return (
			h !== undefined &&
			typeof window !== "undefined" &&
			window.innerHeight - h > 100
		);
	};

	const dropdownMaxHeight = () => {
		const h = viewport.height();
		return h === undefined ? undefined : `${Math.max(h - 32, 120)}px`;
	};

	const onInput = async (value: string) => {
		setHandle(value);
		setMissingHandle(false);

		suggestController?.abort();

		if (value.trim().length === 0) {
			setOptions([]);
			return;
		}

		const controller = new AbortController();
		suggestController = controller;

		const results = await searchActorsTypeahead(value, controller.signal);

		if (controller.signal.aborted) return;

		setOptions(results);
	};

	const onPick = (picked: ActorTypeaheadResult | null) => {
		if (picked) {
			setHandle(picked.handle);
			join();
		}
	};

	const submit = async (
		session: OAuthSession,
	): Promise<"added" | "already-has-access"> => {
		if (isAllowedDid(session.sub)) {
			toast("You already have access to Colibri!", {
				description:
					"Your account is already approved, no need to join the waitlist.",
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: "Sign in",
					onClick: () => navigate("/app/login"),
				},
			});
			try {
				await client?.revoke(session.sub);
			} catch {}
			return "already-has-access";
		}

		const agent = new Agent(session);
		const res = await agent.com.atproto.server.getSession();
		const { did, handle: resolvedHandle, email } = res.data;

		if (!email) {
			throw new Error(
				"Your provider didn't share an email address, so we can't add you.",
			);
		}

		const post = await fetch("/api/waitlist", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ did, handle: resolvedHandle, email }),
		});
		if (!post.ok) throw new Error("We couldn't save your spot. Try again.");

		const result = (await post.json().catch(() => ({}))) as {
			alreadyOnList?: boolean;
		};
		setAlreadyJoined(result.alreadyOnList === true);

		try {
			localStorage.setItem(WAITLIST_JOINED_KEY, did);
		} catch {}

		try {
			await client?.revoke(session.sub);
		} catch {}

		return "added";
	};

	onMount(async () => {
		if (isTauriRuntime()) return;

		try {
			client = await BrowserOAuthClient.load({
				clientId: waitlistClientId(),
				handleResolver: getAppViewHost("http"),
			});
		} catch (err) {
			log.error("loading the waitlist OAuth client failed", { error: err });
			setErrorMessage("We couldn't start the waitlist sign-in. Try again.");
			setPhase("error");
			return;
		}

		const params = readCallbackParams();
		if (!params.has("code") || !params.has("state")) {
			if (hasJoinedWaitlist()) {
				setAlreadyJoined(true);
				setPhase("done");
			}
			return;
		}

		setPhase("returning");
		history.replaceState(null, "", window.location.pathname);

		try {
			const { session } = await client.callback(params);
			const outcome = await submit(session);
			setPhase(outcome === "already-has-access" ? "idle" : "done");
		} catch (err) {
			log.error("completing the waitlist sign-in failed", { error: err });
			setErrorMessage(describeError(err).title);
			setPhase("error");
		}
	});

	const join = async () => {
		if (!client) return;

		const input = handle().trim().replace(/^@/, "");
		if (input.length === 0) {
			setMissingHandle(true);
			return;
		}

		setPhase("connecting");
		try {
			await client.signIn(input, { scope: WAITLIST_SCOPE });
		} catch (err) {
			log.error("waitlist sign-in could not start", { error: err });
			toast.error("Couldn't connect", {
				description:
					err instanceof Error ? err.message : "Please try again shortly.",
			});
			setPhase("idle");
		}
	};

	const openInBrowser = async () => {
		const url = `${WEB_ORIGIN}/app/waitlist`;
		try {
			const { openUrl } = await import("@tauri-apps/plugin-opener");
			await openUrl(url);
		} catch {
			toast(`Open ${url} in your browser to join the waitlist.`);
		}
	};

	return (
		<Show
			when={phase() !== "returning"}
			fallback={
				<div class="fixed inset-0 z-50 bg-black">
					<AppLoadingScreen message="Adding you to the waitlist…" />
				</div>
			}
		>
			<section class="pt-[calc(min(10rem,12vh)+var(--safe-area-top))] pb-[var(--safe-area-bottom)] mx-auto w-full max-w-336 md:px-16 px-6 relative flex flex-col items-center gap-8 min-h-screen animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
				<div class="flex flex-col gap-4 items-center text-center max-w-[52ch]">
					<small class="text-primary text-sm">Almost there.</small>
					<h1 class="text-5xl font-black m-0">JOIN THE WAITLIST</h1>
					<p class="m-0 text-muted-foreground">
						Colibri is in limited early access while we wait on the AT
						Protocol's permissioned data support. Sign in with your ATmosphere
						account and we'll email you the moment there's room.
					</p>
				</div>

				<div class="flex flex-col bg-card w-full max-w-xl rounded-2xl border border-border h-fit relative items-center drop-shadow-black/25 drop-shadow-2xl overflow-hidden p-6 gap-4">
					<Show
						when={phase() === "done"}
						fallback={
							<Show
								when={!isTauriRuntime()}
								fallback={
									<div class="flex flex-col gap-4 w-full items-center text-center">
										<p class="m-0 text-sm text-muted-foreground">
											Joining the waitlist happens in your browser. Open Colibri
											on the web to continue.
										</p>
										<Button class="w-full" onClick={openInBrowser}>
											Open in browser
										</Button>
									</div>
								}
							>
								<div class="flex flex-col gap-4 w-full">
									<div class="relative w-full">
										<hr class="bg-border w-full h-px border-none m-0" />
										<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2 whitespace-nowrap">
											ENTER YOUR HANDLE
										</small>
									</div>
									<div class="flex gap-2 w-full">
										<Search<ActorTypeaheadResult>
											class="flex-1"
											options={options()}
											debounceOptionsMillisecond={250}
											triggerMode="input"
											optionValue="did"
											optionLabel="handle"
											placeholder="alice.bsky.social"
											placement={
												keyboardVisible() ? "top-start" : "bottom-start"
											}
											onInputChange={onInput}
											onChange={onPick}
											itemComponent={(props) => (
												<SearchItem
													item={props.item}
													class="first-of-type:mt-0 last-of-type:mb-0"
												>
													<div class="flex items-center gap-2">
														<img
															src={
																props.item.rawValue.avatar ??
																"/user-placeholder.png"
															}
															alt=""
															class="size-6 rounded-full bg-muted shrink-0"
															loading="lazy"
														/>
														<div class="flex flex-col min-w-0">
															<SearchItemLabel class="text-sm truncate">
																{props.item.rawValue.displayName ??
																	props.item.rawValue.handle}
															</SearchItemLabel>
															<SearchItemDescription class="text-xs truncate">
																@{props.item.rawValue.handle}
															</SearchItemDescription>
														</div>
													</div>
												</SearchItem>
											)}
										>
											<SearchControl aria-label="Handle" />
											<SearchPortal>
												<SearchContent
													style={{ "max-height": dropdownMaxHeight() }}
												>
													<SearchListbox class="m-0" />
													<SearchNoResult>No accounts found.</SearchNoResult>
												</SearchContent>
											</SearchPortal>
										</Search>
										<Button
											class="aria-busy:[&_svg]:flex! aria-busy:[&>span]:hidden"
											aria-busy={phase() === "connecting"}
											onClick={join}
										>
											<Spinner className="hidden" />
											<span>Join</span>
										</Button>
									</div>
									<Show when={missingHandle()}>
										<p class="text-sm text-destructive m-0 w-full text-center">
											Enter your handle — for example alice.bsky.social.
										</p>
									</Show>
									<Show when={phase() === "error"}>
										<p class="text-sm text-destructive m-0 w-full text-center">
											{errorMessage()}
										</p>
									</Show>
									<p class="text-xs text-muted-foreground m-0 text-center">
										We only read your account's email address to add you to the
										list.
									</p>
								</div>
							</Show>
						}
					>
						<div class="flex flex-col gap-4 w-full items-center text-center">
							<h2 class="text-2xl font-bold m-0">
								{alreadyJoined()
									? "You're already on the list ✓"
									: "You're on the list! 🎉"}
							</h2>
							<p class="m-0 text-sm text-muted-foreground">
								{alreadyJoined()
									? "You've already joined the waitlist. We'll email you as soon as we can let you in!"
									: "Thanks for your patience. We'll reach out by email as soon as we can let you in."}
							</p>
							<Button
								variant="secondary"
								class="w-full"
								onClick={() => navigate("/app/login")}
							>
								Back to sign in
							</Button>
						</div>
					</Show>
				</div>
			</section>
		</Show>
	);
};
