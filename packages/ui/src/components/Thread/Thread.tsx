import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { CountBadge } from "../Badge/Badge";
import { Card, type CardTone } from "../Card/Card";

export type ThreadPerson = {
	name: string;
	avatarSrc?: string;
	color?: string;
};

export type ThreadLastMessage = ThreadPerson & {
	text: string;
};

type ThreadSize = "compact" | "regular";

export type ThreadSummaryProps = {
	name: string;
	messageCount: number;
	age: string;
	lastMessage?: ThreadLastMessage;
	typing?: ThreadPerson[];
	unread?: boolean;
	mentions?: number;
	private?: boolean;
	tone?: CardTone;
	onOpen?: JSX.EventHandler<HTMLElement, MouseEvent>;
	class?: string;
};

const countFormat = new Intl.NumberFormat("en");

export const formatMessageCount = (count: number) =>
	count === 1 ? "1 message" : `${countFormat.format(count)} messages`;

const sizes = {
	compact: {
		padding: "p-2.5",
		gap: "gap-2.5",
		tile: "size-9 rounded-control",
		icon: 20,
		name: "h-5 text-sm leading-5",
		line: "h-4 text-xs leading-4",
		avatar: 14,
	},
	regular: {
		padding: "p-3",
		gap: "gap-3",
		tile: "size-11 rounded-control-lg",
		icon: 24,
		name: "h-6 text-base leading-6",
		line: "h-5 text-sm leading-5",
		avatar: 18,
	},
} as const;

const surfaces = {
	card: {
		unread: "[--thread-surface:var(--card)]",
		unreadHover: "hover:[--thread-surface:var(--popover)]",
		read: "border-transparent bg-[color-mix(in_srgb,var(--card)_50%,var(--background))] [--thread-surface:color-mix(in_srgb,var(--card)_50%,var(--background))]",
		readHover: "hover:bg-card hover:[--thread-surface:var(--card)]",
	},
	secondary: {
		unread: "[--thread-surface:var(--secondary)]",
		unreadHover: "hover:[--thread-surface:var(--secondary-highlight)]",
		read: "border-transparent bg-popover-highlight [--thread-surface:var(--popover-highlight)]",
		readHover: "hover:bg-secondary hover:[--thread-surface:var(--secondary)]",
	},
} as const;

export const TinyAvatar = (
	props: ThreadPerson & {
		size: number;
		class?: string;
		style?: JSX.CSSProperties;
	},
) => (
	<span
		aria-hidden="true"
		data-tiny-avatar=""
		class={cx(
			"relative inline-flex shrink-0 overflow-hidden rounded-full bg-accent",
			props.class,
		)}
		style={{
			...props.style,
			width: `${props.size}px`,
			height: `${props.size}px`,
			"background-color": props.color,
		}}
	>
		<Show when={props.avatarSrc}>
			{(src) => (
				<img
					src={src()}
					alt=""
					draggable={false}
					class="absolute inset-0 size-full object-cover"
				/>
			)}
		</Show>
	</span>
);

export const TypingAvatars = (props: {
	people: ThreadPerson[];
	size?: number;
	max?: number;
	class?: string;
}) => {
	const size = () => props.size ?? 20;
	const shown = () => props.people.slice(0, props.max ?? 3);
	return (
		<span
			aria-hidden="true"
			data-typing-avatars=""
			class={cx("flex shrink-0 items-center", props.class)}
		>
			<For each={shown()}>
				{(person, index) => (
					<TinyAvatar
						{...person}
						size={size()}
						class="ring-2 ring-[color:var(--thread-surface,var(--secondary))]"
						style={
							index() > 0
								? { "margin-left": `${-Math.round(size() * 0.4)}px` }
								: undefined
						}
					/>
				)}
			</For>
		</span>
	);
};

const ThreadSummary = (props: ThreadSummaryProps & { size: ThreadSize }) => {
	const size = () => sizes[props.size];
	const typing = () => props.typing ?? [];
	const tone = () => props.tone ?? "secondary";
	const mentions = () => props.mentions ?? 0;
	const read = () => !props.unread && mentions() === 0;
	const surface = () => surfaces[tone()];

	return (
		<Card
			tone={tone()}
			onClick={props.onOpen}
			data-thread={props.size}
			data-state={read() ? "read" : "unread"}
			class={cx(
				"flex items-center",
				size().padding,
				size().gap,
				read() ? surface().read : surface().unread,
				props.onOpen && (read() ? surface().readHover : surface().unreadHover),
				props.size === "compact" &&
					!read() &&
					"shadow-[0_4px_4px_1px_rgb(0_0_0/0.25)]",
				props.class,
			)}
		>
			<span
				data-thread-tile=""
				class={cx(
					"flex shrink-0 items-center justify-center",
					size().tile,
					read()
						? "bg-foreground/5 text-muted-foreground"
						: "bg-foreground/10 text-foreground",
				)}
			>
				<ThreadIcon size={size().icon} />
			</span>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="flex w-full min-w-0 items-center gap-2">
					<span
						data-thread-name=""
						class={cx(
							"min-w-0 truncate",
							size().name,
							read()
								? "font-medium text-muted-foreground"
								: "font-semibold text-foreground",
						)}
						title={props.name}
					>
						{props.name}
					</span>
					<Show when={props.private}>
						<LockKeyholeMinimalisticIcon
							aria-label="Private"
							role="img"
							class="size-3.5 shrink-0 text-muted-foreground"
						/>
					</Show>
					<span class="flex-1" />
					<Switch>
						<Match when={mentions() > 0}>
							<CountBadge count={mentions()} />
						</Match>
						<Match when={props.unread}>
							<span
								data-unread-dot=""
								class="size-2 shrink-0 rounded-full bg-foreground"
							/>
							<span class="sr-only">Unread</span>
						</Match>
					</Switch>
					<span
						data-thread-meta=""
						class="shrink-0 text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums"
					>
						{formatMessageCount(props.messageCount)} · {props.age}
					</span>
				</span>
				<Switch>
					<Match when={typing().length > 0}>
						<span
							data-thread-typing=""
							class={cx(
								"flex w-full min-w-0 items-center gap-1.5",
								size().line,
							)}
						>
							<TypingAvatars people={typing()} size={size().avatar} />
							<span class="min-w-0 truncate text-muted-foreground">
								<TypingNames names={typing().map((person) => person.name)} />
							</span>
						</span>
					</Match>
					<Match when={props.lastMessage}>
						{(message) => (
							<span
								data-thread-last=""
								class={cx(
									"flex w-full min-w-0 items-center gap-1.5",
									size().line,
								)}
							>
								<TinyAvatar {...message()} size={size().avatar} />
								<span
									class={cx(
										"shrink-0 font-semibold",
										read() ? "text-muted-foreground" : "text-foreground",
									)}
								>
									{message().name}
								</span>
								<span
									class={cx(
										"min-w-0 flex-1 truncate",
										read() ? "text-muted-foreground" : "text-foreground",
									)}
								>
									{message().text}
								</span>
							</span>
						)}
					</Match>
				</Switch>
			</span>
		</Card>
	);
};

export const TypingNames = (props: { names: string[] }) => (
	<Switch fallback={<>Several people are typing...</>}>
		<Match when={props.names.length === 1}>
			<span class="font-semibold text-foreground">{props.names[0]}</span> is
			typing...
		</Match>
		<Match when={props.names.length === 2}>
			<span class="font-semibold text-foreground">{props.names[0]}</span> and{" "}
			<span class="font-semibold text-foreground">{props.names[1]}</span> are
			typing...
		</Match>
	</Switch>
);

export type ThreadCardProps = ThreadSummaryProps;

export const ThreadCard = (props: ThreadCardProps) => (
	<ThreadSummary {...props} size="compact" />
);

export type ThreadRowProps = ThreadSummaryProps;

export const ThreadRow = (props: ThreadRowProps) => (
	<ThreadSummary {...props} size="regular" />
);

export type NewMessagesDividerProps = {
	label?: string;
	class?: string;
};

export const NewMessagesDivider = (props: NewMessagesDividerProps) => (
	<div
		data-new-messages=""
		class={cx("flex h-5 items-center gap-2 px-4 select-none", props.class)}
	>
		<span aria-hidden="true" class="h-px flex-1 bg-primary/50" />
		<span class="text-xs leading-4 font-semibold text-primary-highlight">
			{props.label ?? "New messages"}
		</span>
		<span aria-hidden="true" class="h-px flex-1 bg-primary/50" />
	</div>
);
