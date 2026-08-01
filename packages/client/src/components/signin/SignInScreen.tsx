import { logoUrl as ColibriLogo } from "@colibri-social/assets";
import { type Component, Show } from "solid-js";
import { ViewportProvider } from "../../contexts/Viewport";
import { AppLoadingScreen } from "../AppLoadingScreen";
import { AnimatedHeight } from "./AnimatedHeight";
import { createSignInFlow, type SignInMode } from "./createSignInFlow";
import { SignInShowcase } from "./SignInShowcase";
import { SignInSteps } from "./SignInSteps";

export const SignInScreen: Component<{ mode?: SignInMode }> = (props) => (
	<ViewportProvider>
		<SignInScreenContent mode={props.mode} />
	</ViewportProvider>
);

const SignInScreenContent: Component<{ mode?: SignInMode }> = (props) => {
	const flow = createSignInFlow({ mode: props.mode });

	return (
		<Show
			when={flow.callback !== "in-progress"}
			fallback={
				<div class="fixed inset-0 z-50 bg-black">
					<AppLoadingScreen />
				</div>
			}
		>
			<main class="flex h-dvh w-full flex-col overflow-hidden bg-background md:flex-row-reverse">
				<section class="relative flex min-h-0 flex-1 overflow-hidden border-border bg-gradient-to-b from-primary/12 to-transparent md:border-l">
					<SignInShowcase />
				</section>

				<section class="relative z-10 flex max-h-[76dvh] w-full shrink-0 flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-background px-6 pt-5 pb-[calc(1.25rem+var(--safe-area-bottom))] shadow-[0_-24px_48px_-32px_#000] md:max-h-none md:w-[26rem] md:max-w-full md:rounded-none md:border-t-0 md:px-10 md:py-8 md:shadow-none">
					<div class="flex w-full shrink-0 flex-col gap-5 md:my-auto md:gap-6">
						<div class="flex items-center gap-3">
							<img
								src={ColibriLogo}
								width={40}
								height={40}
								alt=""
								class="size-8 md:size-9"
							/>
							<span class="font-display text-xl leading-none text-foreground md:text-2xl">
								colibri
							</span>
						</div>

						<AnimatedHeight>
							<SignInSteps flow={flow} />
						</AnimatedHeight>

						<div class="hidden flex-row flex-wrap items-center gap-3 text-xs text-muted-foreground md:flex">
							<span>Open source</span>
							<span class="size-1 rounded-full bg-muted-foreground" />
							<span>EU-based</span>
							<span class="size-1 rounded-full bg-muted-foreground" />
							<span>Powered by AT Protocol</span>
						</div>
					</div>
				</section>
			</main>
		</Show>
	);
};
