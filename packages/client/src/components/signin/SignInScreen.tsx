import { logoUrl as ColibriLogo } from "@colibri-social/assets";
import { type Component, createEffect, on, onCleanup, Show } from "solid-js";
import { useViewport, ViewportProvider } from "../../contexts/Viewport";
import { animateKeyboardTransition } from "../../utils/keyboard-animation";
import { useIsMobile } from "../../utils/mobile-pane";
import {
	hasNativeKeyboardInsetSync,
	isDesktopNative,
} from "../../utils/platform";
import { readSafeAreaInsets } from "../../utils/safe-area";
import { shellHeightForInset } from "../../utils/visual-viewport";
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

const KEYBOARD_INSET_THRESHOLD = 100;

const panePaddingBottom = (inset: number): string =>
	`calc(2rem + max(var(--safe-area-bottom), ${Math.max(0, inset)}px))`;

const SignInScreenContent: Component<{ mode?: SignInMode }> = (props) => {
	const flow = createSignInFlow({ mode: props.mode });
	const viewport = useViewport();
	const isMobile = useIsMobile();

	const desktopShell = isDesktopNative();
	const needsShellInsets = () => isMobile() && !desktopShell;

	let shellEl: HTMLElement | undefined;
	let shellAnimation: Animation | undefined;
	let paneEl: HTMLElement | undefined;
	let paneAnimation: Animation | undefined;

	const keyboardInset = () => {
		const height = viewport.height();
		if (height === undefined) return 0;
		const inset = window.innerHeight - height;
		return inset > KEYBOARD_INSET_THRESHOLD ? inset : 0;
	};

	const shellHeight = () =>
		needsShellInsets() && viewport.height() !== undefined
			? `${viewport.height()}px`
			: undefined;

	createEffect(
		on(
			() => viewport.keyboardTransition(),
			(transition) => {
				shellAnimation?.cancel();
				paneAnimation?.cancel();
				if (!transition) return;

				if (needsShellInsets()) {
					if (!shellEl) return;

					const safeBottom = readSafeAreaInsets().bottom;
					shellAnimation = animateKeyboardTransition(
						shellEl,
						transition,
						(inset) => ({
							height: `${shellHeightForInset(inset)}px`,
							paddingBottom: `${Math.max(0, safeBottom - inset)}px`,
						}),
					);
					return;
				}

				if (isMobile() || !paneEl) return;

				paneAnimation = animateKeyboardTransition(
					paneEl,
					transition,
					(inset) => ({
						paddingBottom: panePaddingBottom(inset),
					}),
				);
			},
			{ defer: true },
		),
	);

	onCleanup(() => {
		shellAnimation?.cancel();
		paneAnimation?.cancel();
	});

	return (
		<Show
			when={flow.callback !== "in-progress"}
			fallback={
				<div class="fixed inset-0 z-50 bg-black">
					<AppLoadingScreen />
				</div>
			}
		>
			<main
				ref={shellEl}
				class="flex w-full flex-col overflow-hidden bg-background pt-[var(--safe-area-top)] pl-[var(--safe-area-left)] pr-[var(--safe-area-right)] md:flex-row-reverse"
				classList={{
					"h-[calc(100dvh-var(--titlebar-height))]":
						shellHeight() === undefined,
					"transition-[height,transform,padding-bottom] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]":
						needsShellInsets() && !hasNativeKeyboardInsetSync(),
				}}
				style={{
					...(shellHeight() ? { height: shellHeight() } : {}),
					...(needsShellInsets()
						? {
								"padding-bottom": `max(0px, calc(var(--safe-area-bottom) - ${keyboardInset()}px))`,
							}
						: {}),
					...(needsShellInsets() && viewport.offsetTop() > 0
						? { transform: `translateY(${viewport.offsetTop()}px)` }
						: {}),
				}}
			>
				<section class="relative flex min-h-0 flex-1 overflow-hidden border-border bg-gradient-to-b from-primary/12 to-transparent md:border-l">
					<SignInShowcase />
				</section>

				<section
					ref={paneEl}
					class="relative z-10 flex max-h-[min(76dvh,100%)] w-full shrink-0 flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-background px-6 py-5 shadow-[0_-24px_48px_-32px_#000] md:max-h-none md:w-[26rem] md:max-w-full md:rounded-none md:border-t-0 md:px-10 md:py-8 md:shadow-none"
					style={
						isMobile()
							? undefined
							: { "padding-bottom": panePaddingBottom(keyboardInset()) }
					}
				>
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
								Colibri Social
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
