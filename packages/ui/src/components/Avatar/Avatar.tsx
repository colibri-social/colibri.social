import {
	createSignal,
	createUniqueId,
	type JSX,
	Match,
	Show,
	Switch,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";

export type Presence = "online" | "idle" | "dnd" | "offline";

const SIZES = {
	xs: 20,
	sm: 24,
	base: 32,
	md: 40,
	lg: 56,
	xl: 88,
} as const;

export type AvatarSize = keyof typeof SIZES;

export const presenceLabels: Record<Presence, string> = {
	online: "Online",
	idle: "Away",
	dnd: "Do not disturb",
	offline: "Offline",
};

export type PresenceIndicatorProps = {
	presence: Presence;
	size: number;
	label?: string;
	class?: string;
	style?: JSX.CSSProperties;
};

export const PresenceIndicator = (props: PresenceIndicatorProps) => {
	const maskId = createUniqueId();
	const ring = () => Math.max(2, Math.round(props.size / 5));
	const outer = () => props.size + ring() * 2;

	return (
		<span
			role="img"
			aria-label={props.label ?? presenceLabels[props.presence]}
			class={cx(
				"flex items-center justify-center rounded-full bg-(--avatar-ring,var(--background))",
				props.class,
			)}
			style={{ width: `${outer()}px`, height: `${outer()}px`, ...props.style }}
		>
			<svg
				viewBox="0 0 12 12"
				width={props.size}
				height={props.size}
				aria-hidden="true"
			>
				<Switch>
					<Match when={props.presence === "online"}>
						<circle cx="6" cy="6" r="6" fill="var(--success)" />
					</Match>
					<Match when={props.presence === "idle"}>
						<mask id={maskId}>
							<rect width="12" height="12" fill="white" />
							<circle cx="3" cy="3" r="4.5" fill="black" />
						</mask>
						<circle
							cx="6"
							cy="6"
							r="6"
							fill="var(--warning)"
							mask={`url(#${maskId})`}
						/>
					</Match>
					<Match when={props.presence === "dnd"}>
						<mask id={maskId}>
							<rect width="12" height="12" fill="white" />
							<rect
								x="3"
								y="4.75"
								width="6"
								height="2.5"
								rx="1.25"
								fill="black"
							/>
						</mask>
						<circle
							cx="6"
							cy="6"
							r="6"
							fill="var(--destructive)"
							mask={`url(#${maskId})`}
						/>
					</Match>
					<Match when={props.presence === "offline"}>
						<circle
							cx="6"
							cy="6"
							r="4.5"
							fill="none"
							stroke="var(--muted-foreground)"
							stroke-width="3"
						/>
					</Match>
				</Switch>
			</svg>
		</span>
	);
};

export type AvatarProps = Omit<
	JSX.HTMLAttributes<HTMLSpanElement>,
	"children" | "style"
> & {
	src?: string;
	name: string;
	size?: AvatarSize;
	shape?: "circle" | "square";
	presence?: Presence;
	color?: string;
};

const initialsOf = (name: string) =>
	name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");

export const Avatar = (props: AvatarProps) => {
	const [local, rest] = splitProps(props, [
		"src",
		"name",
		"size",
		"shape",
		"presence",
		"color",
		"class",
	]);
	const [loaded, setLoaded] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	const pixels = () => SIZES[local.size ?? "md"];
	const showImage = () => !!local.src && !failed();
	const radius = () =>
		local.shape === "square" ? "rounded-[28%]" : "rounded-full";
	const presenceSize = () => Math.max(6, Math.round(pixels() * 0.25));
	const presenceInset = () => {
		const ring = Math.max(2, Math.round(presenceSize() / 5));
		const edge =
			local.shape === "square" ? -ring - 1 : pixels() * 0.0732 - ring;
		return `${Math.round(edge)}px`;
	};

	return (
		<span
			{...rest}
			class={cx("relative inline-flex shrink-0", local.class)}
			style={{ width: `${pixels()}px`, height: `${pixels()}px` }}
		>
			<span
				class={cx(
					"relative flex size-full items-center justify-center overflow-hidden bg-accent font-semibold text-foreground select-none",
					radius(),
				)}
				style={{
					"background-color": local.color,
					"font-size": `${Math.round(pixels() * 0.4)}px`,
				}}
			>
				<Show when={(!showImage() || !loaded()) && pixels() >= 24}>
					<span aria-hidden="true">{initialsOf(local.name)}</span>
				</Show>
				<Show
					when={showImage()}
					fallback={<span class="sr-only">{local.name}</span>}
				>
					<img
						src={local.src}
						alt={local.name}
						draggable={false}
						onLoad={() => setLoaded(true)}
						onError={() => setFailed(true)}
						class={cx(
							"absolute inset-0 size-full object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8",
							"transition-opacity duration-[calc(180ms*var(--motion-scale))] ease-(--ease-out-quick)",
							radius(),
							!loaded() && "opacity-0",
						)}
					/>
				</Show>
			</span>
			<Show when={local.presence}>
				{(presence) => (
					<PresenceIndicator
						presence={presence()}
						size={presenceSize()}
						label={`${local.name}: ${presenceLabels[presence()]}`}
						class="absolute"
						style={{ right: presenceInset(), bottom: presenceInset() }}
					/>
				)}
			</Show>
		</span>
	);
};
