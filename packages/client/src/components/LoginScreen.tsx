import { Component, createEffect, createSignal } from "solid-js";
import { ATmosphereAppMarquee } from "./login/ATmosphereAppMarquee";
import { Button } from "./ui/Button";
import { Spinner } from "./icons/Spinner";
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
import { toast } from "somoto";
import { useAuthContext } from "../contexts/Auth";
import { useNavigate } from "@solidjs/router";
import {
	searchActorsTypeahead,
	type ActorTypeaheadResult,
} from "../atproto/xrpc/app/bsky/actor/searchActorsTypeahead";

export const LoginScreen: Component = () => {
	const auth = useAuthContext();
	const navigate = useNavigate();
	const [handle, setHandle] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [options, setOptions] = createSignal<Array<ActorTypeaheadResult>>([]);

	let suggestController: AbortController | undefined;

	const onInput = async (value: string) => {
		setHandle(value);

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
			triggerLogin();
		}
	};

	const triggerLogin = async () => {
		if (loading() === true || !auth) return;

		setLoading(true);

		try {
			await auth.client.signIn(handle(), {
				signal: new AbortController().signal,
			});
		} catch (err) {
			console.error(err);
			toast.error(err as any);
		}

		setLoading(false);
	};

	createEffect(() => {
		if (auth?.loggedIn) {
			navigate("/app");
		}
	});

	return (
		<section class="py-40 mx-auto w-full max-w-336 md:px-16 px-6 relative flex flex-col items-center gap-12">
			<div class="flex flex-col gap-4 items-center text-center">
				<small class="text-primary text-sm">Welcome back.</small>
				<h1 class="text-5xl font-black m-0">SIGN IN</h1>
				<p class="m-0 text-muted-foreground">
					Log in with your ATmostphere acccount (e.g. Bluesky) to continue.
				</p>
			</div>
			<div class="flex flex-col bg-card w-full max-w-xl rounded-2xl border border-border h-fit relative items-center drop-shadow-black/25 drop-shadow-2xl overflow-hidden">
				<div class="flex flex-row gap-4 w-full items-center justify-center">
					<ATmosphereAppMarquee />
				</div>
				<div class="relative w-full mt-4">
					<hr class="bg-border w-full h-px border-none m-0" />
					<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2">
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
							onInputChange={onInput}
							onChange={onPick}
							itemComponent={(props) => (
								<SearchItem
									item={props.item}
									class="first-of-type:mt-0 last-of-type:mb-0"
								>
									<div class="flex items-center gap-2">
										<img
											src={props.item.rawValue.avatar}
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
								<SearchContent>
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
							onClick={triggerLogin}
						>
							<Spinner className="hidden" />
							<span>Login</span>
						</Button>
					</div>
				</div>
				<div class="relative w-full mt-4">
					<hr class="bg-border w-full h-px border-none m-0" />
					<small class="text-muted-foreground bg-card absolute top-1/2 left-1/2 transform -translate-1/2 px-2">
						DON'T HAVE AN ACCOUNT?
					</small>
				</div>
				<span class="text-sm text-muted-foreground text-center p-6">
					Send us an e-mail:{" "}
					<a
						class="text-muted-foreground hover:underline decoration-muted-foreground"
						href="mailto:pds@colibri.social"
					>
						pds@colibri.social
					</a>
					!
				</span>
			</div>
			<div class="flex flex-row items-center justify-center text-muted-foreground w-full max-w-xl gap-4 text-sm">
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
