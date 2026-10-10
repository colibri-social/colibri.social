import { Dialog } from "@kobalte/core/dialog";
import { CheckReadIcon } from "@solar-icons/solid/bold/check-read";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { createHeightTransition } from "../../utils/height-transition";
import { Hummingbird } from "../Hummingbird/Hummingbird";
import { Modal } from "../Modal/Modal";
import {
	createOnboardingChrome,
	type OnboardingAction,
	type OnboardingActionSet,
	OnboardingFooterActions,
	type OnboardingVariant,
	runOnboardingBack,
	runOnboardingPrimary,
} from "./OnboardingChrome";
import type { OnboardingStep, OnboardingStepItem } from "./onboarding-steps";
import { PagerDots } from "./PagerDots";

export type OnboardingPlatform = "mobile" | "desktop";

export type OnboardingFlowProps = {
	platform?: OnboardingPlatform;
	title: string;
	dot?: number;
	dotCount?: number;
	steps?: OnboardingStepItem[];
	onStepSelect?: (step: OnboardingStep) => void;
	onBack?: () => void;
	open?: boolean;
	class?: string;
	children: JSX.Element;
};

const SKIP_ENTER =
	"textarea, button, a[href], select, [contenteditable], [role='switch'], [role='slider'], [role='listbox'], [role='option'], [role='combobox']";

const isModified = (event: KeyboardEvent) =>
	event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

export const OnboardingFlow = (props: OnboardingFlowProps) => {
	const heightTransition = createHeightTransition();
	const variant = (): OnboardingVariant =>
		props.platform === "desktop" ? "split" : "mobile";
	const {
		chrome,
		actions: registered,
		Provider,
	} = createOnboardingChrome(variant);
	const fallbackBack = (): OnboardingAction | undefined => {
		const back = props.onBack;
		return back ? { label: "Back", onClick: back } : undefined;
	};
	const actions = (): OnboardingActionSet | undefined => {
		const current = registered();
		if (!current) return undefined;
		return {
			get back() {
				return current.back ?? fallbackBack();
			},
			get secondary() {
				return current.secondary;
			},
			get primary() {
				return current.primary;
			},
		};
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.defaultPrevented || event.isComposing) return;
		if (event.key === "ArrowLeft" && event.altKey) {
			if (runOnboardingBack(actions())) event.preventDefault();
			return;
		}
		if (event.key !== "Enter" || isModified(event)) return;
		const target = event.target as HTMLElement | null;
		if (!target) return;
		if (target instanceof HTMLInputElement && target.form) {
			const primary = actions()?.primary;
			if (primary?.form !== target.form.id) return;
			if (runOnboardingPrimary(actions())) event.preventDefault();
			return;
		}
		if (target.closest(SKIP_ENTER)) return;
		if (runOnboardingPrimary(actions())) event.preventDefault();
	};

	const pager = () => (
		<div class="flex h-7 shrink-0 items-center justify-center">
			<Show when={props.dot !== undefined && props.dotCount}>
				{(count) => (
					<PagerDots count={count()} index={props.dot ?? 0} class="p-0" />
				)}
			</Show>
		</div>
	);

	const mobile = () => (
		<section
			aria-label={props.title}
			data-onboarding=""
			data-platform="mobile"
			class={cx(
				"flex min-h-dvh flex-col bg-background pt-safe text-foreground",
				props.class,
			)}
		>
			<div class="flex flex-1 flex-col items-center justify-center px-6 py-8">
				<div class="flex w-full max-w-[402px] flex-col items-center">
					{props.children}
				</div>
			</div>
			<div class="pb-safe-offset-2">{pager()}</div>
		</section>
	);

	const stepList = () => (
		<ol
			aria-label="Setup steps"
			data-onboarding-steps=""
			class="m-0 flex list-none flex-col gap-1 p-0"
		>
			<For each={props.steps ?? []}>
				{(step) => {
					const marker = () => (
						<span
							aria-hidden="true"
							data-step-marker={step.status}
							class={cx(
								"flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
								step.status === "completed" &&
									"border-transparent bg-primary-fill text-primary-foreground",
								step.status === "current" &&
									"border-primary text-primary-highlight",
								step.status === "upcoming" &&
									"border-control-border text-muted-foreground",
							)}
						>
							<Show when={step.status === "completed"}>
								<CheckReadIcon class="size-3.5" />
							</Show>
							<Show when={step.status === "current"}>
								<span class="size-2 rounded-full bg-primary" />
							</Show>
						</span>
					);
					const content = () => (
						<>
							{marker()}
							<span class="min-w-0 truncate">{step.label}</span>
						</>
					);
					const rowClass =
						"flex h-10 w-full items-center gap-3 rounded-control px-2 text-left text-sm";
					return (
						<li data-onboarding-step={step.id} data-status={step.status}>
							<Switch
								fallback={
									<div
										aria-current={
											step.status === "current" ? "step" : undefined
										}
										class={cx(
											rowClass,
											step.status === "current"
												? "bg-secondary font-semibold text-foreground"
												: "text-muted-foreground",
										)}
									>
										{content()}
									</div>
								}
							>
								<Match when={step.target && props.onStepSelect}>
									<button
										type="button"
										onClick={() => {
											if (step.target) props.onStepSelect?.(step.target);
										}}
										class={cx(
											rowClass,
											"focus-ring cursor-pointer font-medium text-foreground hover:bg-secondary",
										)}
									>
										{content()}
									</button>
								</Match>
							</Switch>
						</li>
					);
				}}
			</For>
		</ol>
	);

	const dialogContent = (inner: () => JSX.Element, contentClass: string) => (
		<Modal open={props.open ?? true}>
			<Dialog.Portal>
				<Dialog.Overlay class="overlay-motion fixed inset-0 z-50 bg-overlay backdrop-blur-md" />
				<div class="fixed inset-0 z-50 flex items-center justify-center px-safe-offset-4 pt-safe-offset-4 pb-safe-offset-4">
					<Dialog.Content
						ref={heightTransition}
						data-onboarding=""
						data-platform="desktop"
						data-variant={variant()}
						onKeyDown={onKeyDown}
						onEscapeKeyDown={(event) => {
							event.preventDefault();
							runOnboardingBack(actions());
						}}
						onPointerDownOutside={(event) => event.preventDefault()}
						onInteractOutside={(event) => event.preventDefault()}
						class={cx(
							"modal-motion relative flex w-full origin-center overflow-hidden rounded-surface border border-border bg-background text-foreground shadow-overlay outline-none",
							contentClass,
							props.class,
						)}
					>
						{inner()}
					</Dialog.Content>
				</div>
			</Dialog.Portal>
		</Modal>
	);

	const footer = () => (
		<div class="shrink-0 border-t border-border px-6 py-4">
			<OnboardingFooterActions actions={actions()} />
		</div>
	);

	const split = () =>
		dialogContent(
			() => (
				<>
					<Dialog.Title class="sr-only">{props.title}</Dialog.Title>
					<aside
						data-onboarding-sidebar=""
						class="flex w-[280px] shrink-0 flex-col gap-8 border-r border-border bg-card px-6 py-8"
					>
						<div class="flex h-24 items-center justify-center">
							<Hummingbird size={88} dart poke dartRange={{ x: 48, y: 24 }} />
						</div>
						{stepList()}
					</aside>
					<div class="flex min-w-0 flex-1 flex-col">
						<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 pt-10 pb-8">
							<div class="my-auto flex w-full flex-col items-center">
								{props.children}
							</div>
						</div>
						{footer()}
					</div>
				</>
			),
			"max-w-[880px] min-h-[min(560px,100%)] max-h-[min(760px,100%)] flex-row",
		);

	return (
		<Provider value={chrome}>
			<Show when={variant() === "split"} fallback={mobile()}>
				{split()}
			</Show>
		</Provider>
	);
};
