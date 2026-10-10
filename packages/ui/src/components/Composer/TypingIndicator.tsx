import {
	createEffect,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import {
	nameColorClass,
	nameColorStyle,
	useNameColor,
} from "../../utils/name-color";
import { Avatar } from "../Avatar/Avatar";

export type TypingUser = {
	name: string;
	avatarSrc?: string;
	color?: string;
	nameColor?: string;
	roleColor?: string;
};

export type TypingIndicatorProps = {
	users: TypingUser[];
	size?: "sm" | "md";
	class?: string;
};

const MAX_AVATARS = 3;
const DOT_CYCLE_MS = 1200;

const Name = (props: { user?: TypingUser }) => {
	const color = useNameColor(() => ({
		userColor: props.user?.nameColor,
		roleColor: props.user?.roleColor,
		context: "chat",
	}));
	return (
		<span
			data-typing-name=""
			class={cx("font-semibold", color() ? nameColorClass : "text-foreground")}
			style={nameColorStyle(color())}
		>
			{props.user?.name}
		</span>
	);
};

const Dots = () => {
	const dots: HTMLSpanElement[] = [];

	createEffect(() => {
		if (prefersReducedMotion()) return;
		const duration = DOT_CYCLE_MS * motionScale();
		const animations = dots.map((dot, index) =>
			dot.animate(
				[
					{ opacity: 0.35, offset: 0 },
					{ opacity: 1, offset: 0.25 },
					{ opacity: 0.35, offset: 0.5 },
					{ opacity: 0.35, offset: 1 },
				],
				{
					duration,
					delay: (index * duration) / 6,
					iterations: Number.POSITIVE_INFINITY,
					easing: "ease-in-out",
				},
			),
		);
		onCleanup(() => {
			for (const animation of animations) animation.cancel();
		});
	});

	return (
		<span data-typing-dots="">
			<For each={[0, 1, 2]}>
				{(index) => (
					<span
						ref={(element) => {
							dots[index] = element;
						}}
					>
						.
					</span>
				)}
			</For>
		</span>
	);
};

export const TypingIndicator = (props: TypingIndicatorProps) => {
	const [lastUsers, setLastUsers] = createSignal<TypingUser[]>(props.users);
	createEffect(() => {
		if (props.users.length > 0) setLastUsers(props.users);
	});
	const active = () => props.users.length > 0;
	const users = () => (active() ? props.users : lastUsers());
	const shown = () => users().slice(0, MAX_AVATARS);

	return (
		<div
			role="status"
			aria-hidden={active() ? undefined : "true"}
			data-typing-indicator=""
			data-active={active() || undefined}
			class={cx(
				"flex min-w-0 items-center text-xs text-muted-foreground",
				props.size === "sm" ? "h-6" : "h-8",
				props.size === "sm" ? "gap-1" : "gap-3",
				"in-data-composer-typing:gap-(--composer-gap)",
				"opacity-0 transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)] data-active:opacity-100",
				"motion-reduce:transition-none reduced-motion:transition-none",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				data-typing-avatars=""
				class={cx(
					"flex shrink-0 items-center",
					props.size === "sm" ? "h-6" : "h-8",
					"ps-0.5",
					"in-data-composer-typing:ms-(--composer-inset) in-data-composer-typing:w-8 in-data-composer-typing:justify-center in-data-composer-typing:ps-0",
				)}
			>
				<For each={shown()}>
					{(user, index) => (
						<span
							class="relative flex rounded-full shadow-[0_0_0_2px_var(--typing-ring,var(--card))]"
							style={{
								"margin-inline-start": index() === 0 ? "0px" : "-12px",
								"z-index": String(MAX_AVATARS - index()),
							}}
						>
							<Avatar
								name={user.name}
								src={user.avatarSrc}
								color={user.color}
								size="xs"
							/>
						</span>
					)}
				</For>
			</span>
			<span data-typing-names="" class="min-w-0 truncate whitespace-nowrap">
				<Switch>
					<Match when={users().length === 1}>
						<Name user={users()[0]} /> is typing
					</Match>
					<Match when={users().length === 2}>
						<Name user={users()[0]} /> and <Name user={users()[1]} /> are typing
					</Match>
					<Match when={users().length === 3}>
						<Name user={users()[0]} />, <Name user={users()[1]} /> and{" "}
						<Name user={users()[2]} /> are typing
					</Match>
					<Match when={users().length > 3}>Several people are typing</Match>
				</Switch>
				<Show when={users().length > 0}>
					<Dots />
				</Show>
			</span>
		</div>
	);
};
