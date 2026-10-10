import {
	createContext,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	Show,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Entrance } from "./Entrance";

export type OnboardingVariant = "mobile" | "split";

export type OnboardingAction = {
	label: string;
	onClick?: () => void;
	type?: "button" | "submit";
	form?: string;
	disabled?: boolean;
	loading?: boolean;
	icon?: JSX.Element;
};

export type OnboardingActionSet = {
	back?: OnboardingAction;
	secondary?: OnboardingAction;
	primary: OnboardingAction;
};

type Chrome = {
	variant: () => OnboardingVariant;
	register: (actions: OnboardingActionSet) => () => void;
};

const MOBILE_CHROME: Chrome = {
	variant: () => "mobile",
	register: () => () => {},
};

const ChromeContext = createContext<Chrome>(MOBILE_CHROME);

export const useOnboardingChrome = () => useContext(ChromeContext);

export const createOnboardingChrome = (variant: () => OnboardingVariant) => {
	const [actions, setActions] = createSignal<OnboardingActionSet>();
	const chrome: Chrome = {
		variant,
		register: (next) => {
			setActions(() => next);
			return () => {
				if (actions() === next) setActions(undefined);
			};
		},
	};
	return { chrome, actions, Provider: ChromeContext.Provider };
};

const runAction = (action: OnboardingAction | undefined) => {
	if (!action || action.disabled || action.loading) return false;
	if (action.type === "submit" && action.form) {
		const form = document.getElementById(action.form);
		if (form instanceof HTMLFormElement) {
			form.requestSubmit();
			return true;
		}
	}
	action.onClick?.();
	return true;
};

export const runOnboardingPrimary = (actions?: OnboardingActionSet) =>
	runAction(actions?.primary);

export const runOnboardingBack = (actions?: OnboardingActionSet) =>
	runAction(actions?.back);

type ActionSlot = keyof OnboardingActionSet;

const SLOT_VARIANT: Record<ActionSlot, "primary" | "secondary" | "tertiary"> = {
	back: "secondary",
	secondary: "secondary",
	primary: "primary",
};

const actionButton = (
	action: () => OnboardingAction | undefined,
	variant: "primary" | "secondary" | "tertiary",
	extra: { block?: boolean; hint?: string } = {},
) => (
	<Button
		type={action()?.type ?? "button"}
		form={action()?.form}
		variant={variant}
		block={extra.block}
		disabled={action()?.disabled}
		loading={action()?.loading}
		icon={action()?.icon}
		aria-keyshortcuts={extra.hint ? "Enter" : undefined}
		onClick={() => {
			const current = action();
			if (current && current.type !== "submit") current.onClick?.();
		}}
	>
		{action()?.label}
		<Show when={extra.hint}>
			<span
				aria-hidden="true"
				data-onboarding-key-hint=""
				class="-mr-1 ml-1 flex h-5 min-w-5 items-center justify-center rounded-control-xs bg-black/15 px-1 font-sans text-xs leading-none font-semibold"
			>
				{extra.hint}
			</span>
		</Show>
	</Button>
);

const presentSlots = (actions: OnboardingActionSet | undefined) =>
	(["back", "secondary", "primary"] as const).filter(
		(slot) => actions?.[slot] !== undefined,
	);

const sameSlots = (a: readonly ActionSlot[], b: readonly ActionSlot[]) =>
	a.length === b.length && a.every((slot, index) => slot === b[index]);

export type OnboardingActionsProps = OnboardingActionSet & {
	group: number;
	inline?: "grid" | "center";
	class?: string;
};

export const OnboardingActions = (props: OnboardingActionsProps) => {
	const chrome = useOnboardingChrome();
	const docked = () => chrome.variant() !== "mobile";

	const unregister = chrome.register({
		get back() {
			return props.back;
		},
		get secondary() {
			return props.secondary;
		},
		get primary() {
			return props.primary;
		},
	});
	onCleanup(unregister);

	const slots = createMemo(() => presentSlots(props), [], {
		equals: sameSlots,
	});
	const grid = () => props.inline === "grid" && slots().length > 1;

	return (
		<Show when={!docked()}>
			<div
				data-onboarding-actions="inline"
				class={cx(
					grid()
						? "grid w-full grid-cols-2 gap-4"
						: "flex items-center justify-center gap-4",
					props.class,
				)}
			>
				<For each={slots()}>
					{(slot, index) => (
						<Entrance group={props.group + index()}>
							{actionButton(
								() => props[slot],
								slot === "primary" ? "primary" : "secondary",
								{ block: grid() },
							)}
						</Entrance>
					)}
				</For>
			</div>
		</Show>
	);
};

export const OnboardingFooterActions = (props: {
	actions?: OnboardingActionSet;
}) => {
	const slots = createMemo(() => presentSlots(props.actions), [], {
		equals: sameSlots,
	});
	return (
		<div
			data-onboarding-actions="footer"
			class="flex min-h-10 items-center justify-end gap-3"
		>
			<For each={slots()}>
				{(slot) =>
					actionButton(
						() => props.actions?.[slot],
						slot === "back" ? "tertiary" : SLOT_VARIANT[slot],
						{ hint: slot === "primary" ? "↵" : undefined },
					)
				}
			</For>
		</div>
	);
};
