import { useNavigate } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	onMount,
	Show,
} from "solid-js";
import { toast } from "somoto";
import { ALLOWLIST_ENABLED, isAllowedDid } from "../atproto/allowlist";
import {
	asSignInError,
	beginSignInAttempt,
	endSignInAttempt,
	noteSignInHandle,
	preflightFetch,
	reportSignInFailure,
	startOAuthSignIn,
} from "../atproto/auth";
import { buildScopes } from "../atproto/scopes";
import {
	type ActorTypeaheadResult,
	searchActorsTypeahead,
} from "../atproto/xrpc/app/bsky/actor/searchActorsTypeahead";
import { useAuthContext } from "../contexts/Auth";
import { useViewport, ViewportProvider } from "../contexts/Viewport";
import { getAppViewDid, getAppViewHost } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { openExternalLink } from "../utils/open-external-link";
import { AppLoadingScreen } from "./AppLoadingScreen";
import { Spinner } from "./icons/Spinner";
import { ATmosphereAppMarquee } from "./login/ATmosphereAppMarquee";
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
import { hasJoinedWaitlist } from "./WaitlistScreen";

const log = createLogger("login");

type CallbackState = "in-progress" | "failed" | null;

const readCallbackParams = (): URLSearchParams | null => {
	if (typeof window === "undefined") return null;
	const raw = window.location.hash.startsWith("#")
		? window.location.hash.slice(1)
		: window.location.search.slice(1);
	return new URLSearchParams(raw);
};

const classifyCallback = (params: URLSearchParams | null): CallbackState => {
	if (!params) return null;
	if (params.has("error")) return "failed";
	if (params.has("state") && params.has("code")) return "in-progress";
	return null;
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	access_denied: "You declined the sign-in request.",
	login_required: "Your provider needs you to sign in again.",
	temporarily_unavailable:
		"Your provider is temporarily unavailable. Try again shortly.",
};

const describeOAuthError = (params: URLSearchParams): string => {
	const code = params.get("error") ?? "";
	return (
		params.get("error_description") ??
		OAUTH_ERROR_MESSAGES[code] ??
		(code ? `Your provider returned "${code}".` : "Please try again.")
	);
};

const HANDLE_NOT_FOUND =
	"We couldn't find that handle. Double-check it and try again.";

const resolveHandleToDid = async (input: string): Promise<string> => {
	if (input.startsWith("did:")) return input;

	let res: Response;
	try {
		res = await preflightFetch(
			`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(input)}`,
		);
	} catch (err) {
		await reportSignInFailure(err, input, "resolve-handle");
		throw asSignInError(err);
	}

	if (!res.ok) {
		if (res.status === 400 || res.status === 404) {
			throw new Error(HANDLE_NOT_FOUND);
		}
		await reportSignInFailure(
			new Error(`resolveHandle returned ${res.status}`),
			input,
			"resolve-handle",
		);
		throw new Error(
			`${new URL(getAppViewHost("http")).host} isn't responding right now. Try again shortly.`,
		);
	}

	const data = (await res.json()) as { did?: string };
	if (!data.did) throw new Error(HANDLE_NOT_FOUND);

	return data.did;
};

const describeThrownError = (err: unknown): string => {
	if (
		err instanceof DOMException &&
		(err.name === "TimeoutError" || err.name === "AbortError")
	) {
		return "Sign-in timed out. Check your connection and try again.";
	}
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === "string" && err) return err;
	return "Something went wrong. Please try again.";
};

export const LoginScreen: Component = () => {
	return (
		<ViewportProvider>
			<LoginScreenContent />
		</ViewportProvider>
	);
};

const LoginScreenContent: Component = () => {
	const auth = useAuthContext();
	const navigate = useNavigate();
	const viewport = useViewport();
	const [handle, setHandle] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [missingHandle, setMissingHandle] = createSignal(false);
	const [notAllowed, setNotAllowed] = createSignal(false);
	const [joinedWaitlist] = createSignal(hasJoinedWaitlist());
	const [options, setOptions] = createSignal<Array<ActorTypeaheadResult>>([]);

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

	const callbackParams = readCallbackParams();
	const callback = classifyCallback(callbackParams);

	let suggestController: AbortController | undefined;

	onMount(() => {
		if (callback !== "failed" || !callbackParams) return;
		toast.error("Sign-in failed", {
			description: describeOAuthError(callbackParams),
		});
		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);
	});

	const onInput = async (value: string) => {
		setHandle(value);
		setMissingHandle(false);
		setNotAllowed(false);

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
			triggerLogin(picked.did);
		}
	};

	const triggerLogin = async (knownDid?: string) => {
		if (loading() === true || !auth) return;

		const input = handle().trim().replace(/^@/, "").toLowerCase();
		if (input.length === 0) {
			setMissingHandle(true);
			return;
		}

		setLoading(true);
		setNotAllowed(false);
		beginSignInAttempt();
		noteSignInHandle(input);

		try {
			const did = knownDid ?? (await resolveHandleToDid(input));

			if (!isAllowedDid(did)) {
				setNotAllowed(true);
				return;
			}

			await startOAuthSignIn(auth.client, did, {
				scope: buildScopes(getAppViewDid()).join(" "),
			});
		} catch (err) {
			log.error("sign-in failed", { error: err });
			toast.error("Sign-in failed", {
				description: describeThrownError(err),
			});
		} finally {
			endSignInAttempt();
			setLoading(false);
		}
	};

	createEffect(() => {
		if (auth?.loggedIn) {
			navigate("/app");
		}
	});

	return (
		<Show
			when={callback !== "in-progress"}
			fallback={
				<div class="fixed inset-0 z-50 bg-black">
					<AppLoadingScreen />
				</div>
			}
		>
			<section class="pt-[calc(min(10rem,12vh)+var(--safe-area-top))] pb-[var(--safe-area-bottom)] mx-auto w-full max-w-336 md:px-16 px-6 relative flex flex-col items-center gap-8 min-h-screen animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
				<div class="flex flex-col gap-4 items-center text-center">
					<small class="text-primary text-sm">Welcome back.</small>
					<h1 class="text-5xl font-black m-0">SIGN IN</h1>
					<p class="m-0 text-muted-foreground">
						Log in with your ATmosphere acccount to continue.
					</p>
				</div>
				<div class="flex flex-col bg-card w-full max-w-xl rounded-2xl border border-border h-fit relative items-center drop-shadow-black/25 drop-shadow-2xl overflow-hidden">
					<div class="flex flex-row gap-4 w-full items-center justify-center">
						<ATmosphereAppMarquee />
					</div>
					<div class="relative w-full mt-4">
						<hr class="bg-border w-full h-px border-none m-0" />
						<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2 whitespace-nowrap">
							ENTER YOUR HANDLE
						</small>
					</div>
					<div class="flex flex-col gap-4 w-full p-6 pb-3 items-center justify-center">
						<div class="flex gap-2 w-full">
							<Search<ActorTypeaheadResult>
								class="flex-1"
								options={options()}
								debounceOptionsMillisecond={250}
								triggerMode="input"
								optionValue="did"
								optionLabel="handle"
								placeholder="alice.bsky.social"
								placement={keyboardVisible() ? "top-start" : "bottom-start"}
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
													props.item.rawValue.avatar ?? "/user-placeholder.png"
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
								<SearchControl
									aria-label="Handle"
									inputProps={{
										autocapitalize: "none",
										autocorrect: "off",
										autocomplete: "username",
										spellcheck: false,
									}}
								/>
								<SearchPortal>
									<SearchContent style={{ "max-height": dropdownMaxHeight() }}>
										<SearchListbox class="m-0" />
										<SearchNoResult>No accounts found.</SearchNoResult>
									</SearchContent>
								</SearchPortal>
							</Search>
							<Button
								id="login-btn"
								class="aria-busy:[&_svg]:flex! aria-busy:[&>span]:hidden"
								type={"submit"}
								aria-busy={loading()}
								onClick={() => triggerLogin()}
							>
								<Spinner className="hidden" />
								<span>Login</span>
							</Button>
						</div>
						<Show when={missingHandle()}>
							<p class="text-sm text-destructive m-0 w-full text-center">
								Enter your handle to sign in, for example alice.bsky.social.
							</p>
						</Show>
						<Show when={notAllowed()}>
							<p class="text-sm text-destructive m-0 w-full text-center">
								Colibri is in limited early access right now, and your account
								isn't on the list yet.{" "}
								<button
									type="button"
									class="text-primary hover:underline"
									onClick={() => navigate("/app/waitlist")}
								>
									{joinedWaitlist()
										? "check your waitlist status"
										: "join the waitlist"}
								</button>{" "}
								and we'll let you in soon.
							</p>
						</Show>
						<Show when={loading()}>
							<p class="text-sm text-muted-foreground m-0 w-full text-center animate-pulse">
								Contacting your provider…
							</p>
						</Show>
						<div class="flex flex-col gap-3 w-full">
							<details class="w-full">
								<summary class="list-none [&::-webkit-details-marker]:hidden cursor-pointer text-sm text-muted-foreground text-center hover:text-foreground select-none">
									What's an ATmosphere account?
								</summary>
								<p class="text-sm text-foreground leading-relaxed bg-muted rounded-md p-3 mt-2 mb-0">
									Colibri runs on the AT Protocol, an open social network built
									on open standards. One account works across every app on the
									network, and there's no lock-in: you can move your data to
									another provider, or host it yourself, at any time. You can
									read more at{" "}
									<a
										href="https://atmosphereaccount.com"
										target="_blank"
										rel="noreferrer"
										class="text-primary hover:underline"
										onClick={(e) =>
											openExternalLink("https://atmosphereaccount.com", e)
										}
									>
										atmosphereaccount.com
									</a>
									.
								</p>
							</details>
						</div>
					</div>
					<Show when={ALLOWLIST_ENABLED}>
						<div class="relative w-full mt-4">
							<hr class="bg-border w-full h-px border-none m-0" />
							<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2 whitespace-nowrap">
								{joinedWaitlist()
									? "YOU'RE ON THE LIST"
									: "NOT ON THE LIST YET?"}
							</small>
						</div>
						<div class="w-full p-6 flex flex-col gap-3">
							<p class="text-sm text-muted-foreground m-0 text-center">
								<Show
									when={joinedWaitlist()}
									fallback="Colibri is in limited early access while we wait on the AT Protocol's permissioned data support. Leave your email and we'll reach out when there's room."
								>
									You've joined the waitlist — we'll email you the moment
									there's room. No need to sign up again.
								</Show>
							</p>
							<Button
								variant="secondary"
								class="w-full"
								onClick={() => navigate("/app/waitlist")}
							>
								{joinedWaitlist()
									? "View waitlist status"
									: "Join the waitlist"}
							</Button>
						</div>
					</Show>
					<Show when={!ALLOWLIST_ENABLED}>
						<div class="relative w-full mt-4">
							<hr class="bg-border w-full h-px border-none m-0" />
							<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2 whitespace-nowrap">
								DON'T HAVE AN ACCOUNT?
							</small>
						</div>
						<div class="w-full p-6">
							<Button
								variant="secondary"
								class="w-full"
								onClick={() => navigate("/app/register")}
							>
								Sign up
							</Button>
						</div>
					</Show>
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
		</Show>
	);
};
