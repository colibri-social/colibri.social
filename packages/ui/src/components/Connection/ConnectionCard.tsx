import { CloudCrossIcon } from "@solar-icons/solid/bold/cloud-cross";
import { WiFiOffIcon } from "@solar-icons/solid/bold/wi-fi-off";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import type { ChatPlatform } from "../Message/layout";
import { Spinner } from "../Spinner/Spinner";

export type ConnectionCardState = "reconnecting" | "unreachable" | "offline";

export type ConnectionCardProps = {
	state: ConnectionCardState;
	platform: ChatPlatform;
	visible: boolean;
	animate?: boolean;
	retryAt?: number;
	onRetry?: () => void;
	retrying?: boolean;
	title?: string;
	description?: string;
	retryLabel?: string;
	class?: string;
};

export const CONNECTION_CARD_INSET: Record<
	ChatPlatform,
	{ top: number; side: number }
> = {
	mobile: { top: 12, side: 12 },
	desktop: { top: 32, side: 16 },
};

export const connectionCardTitle = (state: ConnectionCardState) => {
	if (state === "offline") return "You're offline";
	if (state === "unreachable") return "Can't connect right now";
	return "Reconnecting";
};

export const connectionCardDescription = (
	state: ConnectionCardState,
	secondsLeft: number | undefined,
) => {
	if (state === "offline") return "Colibri picks up when you're back";
	if (state === "reconnecting")
		return "New messages show up once you're connected";
	if (secondsLeft === undefined || secondsLeft <= 0) return "Trying again now";
	return `Trying again in ${secondsLeft} s`;
};

const motion =
	"transition-[opacity,translate,filter] ease-out motion-reduce:transition-none reduced-motion:transition-none data-[visible]:duration-[calc(200ms*var(--motion-scale))] not-data-[visible]:duration-[calc(150ms*var(--motion-scale))] not-data-[visible]:blur-[4px]";

const createSecondsLeft = (
	retryAt: () => number | undefined,
	active: () => boolean,
) => {
	const [now, setNow] = createSignal(Date.now());
	createEffect(() => {
		if (!active() || retryAt() === undefined) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 250);
		onCleanup(() => clearInterval(timer));
	});
	return () => {
		const target = retryAt();
		if (target === undefined) return undefined;
		return Math.max(0, Math.ceil((target - now()) / 1000));
	};
};

export const ConnectionCard = (props: ConnectionCardProps) => {
	const titleId = createUniqueId();
	const mobile = () => props.platform === "mobile";
	const inset = () => CONNECTION_CARD_INSET[props.platform];
	const [shown, setShown] = createSignal(props.state);
	createEffect(() => {
		if (props.visible) setShown(props.state);
	});
	const unreachable = () => shown() === "unreachable";
	const secondsLeft = createSecondsLeft(
		() => props.retryAt,
		() => props.visible && unreachable(),
	);
	const title = createMemo(() => props.title ?? connectionCardTitle(shown()));
	const description = createMemo(
		() =>
			props.description ?? connectionCardDescription(shown(), secondsLeft()),
	);
	return (
		<div
			data-connection-card-slot=""
			data-visible={props.visible || undefined}
			inert={!props.visible || undefined}
			class={cx(
				"pointer-events-none absolute inset-x-0 z-20 flex justify-center",
				props.animate !== false && motion,
				props.visible ? "opacity-100" : "-translate-y-1 opacity-0",
				props.class,
			)}
			style={{
				top: `${inset().top}px`,
				"padding-inline": `${inset().side}px`,
			}}
		>
			<div
				data-connection-card={shown()}
				role="status"
				aria-live="polite"
				aria-labelledby={titleId}
				class={cx(
					"pointer-events-auto flex w-full min-w-0 items-center gap-3 border border-border bg-popover p-2 text-foreground shadow-overlay",
					mobile() ? "rounded-sheet" : "max-w-md rounded-surface",
				)}
			>
				<span
					aria-hidden="true"
					data-connection-card-icon=""
					class={cx(
						"flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary [&>svg]:size-5",
						unreachable() ? "text-foreground" : "text-muted-foreground",
					)}
				>
					<Switch fallback={<Spinner size={18} />}>
						<Match when={shown() === "offline"}>
							<WiFiOffIcon />
						</Match>
						<Match when={unreachable()}>
							<CloudCrossIcon />
						</Match>
					</Switch>
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<p
						id={titleId}
						data-connection-card-title=""
						class="m-0 text-sm font-semibold text-pretty"
					>
						{title()}
					</p>
					<p
						data-connection-card-description=""
						class="m-0 text-xs leading-prose text-pretty text-muted-foreground tabular-nums"
					>
						{description()}
					</p>
				</div>
				<Show when={unreachable() && props.onRetry}>
					<button
						type="button"
						data-connection-card-retry=""
						aria-label={props.retryLabel ?? "Try now"}
						aria-busy={props.retrying || undefined}
						disabled={props.retrying}
						onClick={() => props.onRetry?.()}
						class={cx(
							"pressable focus-ring relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border border-border bg-secondary text-sm font-semibold whitespace-nowrap text-foreground enabled:hover:bg-secondary-highlight disabled:cursor-default",
							mobile()
								? "h-11 rounded-control-lg px-4"
								: "h-8 rounded-control-sm px-3",
						)}
					>
						<span class={cx(props.retrying && "invisible")}>
							{props.retryLabel ?? "Try now"}
						</span>
						<Show when={props.retrying}>
							<Spinner size={16} class="absolute" />
						</Show>
					</button>
				</Show>
			</div>
		</div>
	);
};
