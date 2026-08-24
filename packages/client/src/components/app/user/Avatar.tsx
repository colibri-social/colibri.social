import { Show } from "solid-js";
import type { ProfileView } from "../../../atproto/views";
import { cx } from "../../../utils/cva";

const FALLBACK_AVATAR = "/user-placeholder.png";

export function Avatar(props: {
	user: ProfileView;
	nickname?: string;
	size?: "small" | "base" | "large";
	disableState?: boolean;
	overrideSrc?: string;
	class?: string;
}) {
	return (
		<div
			class={cx(
				`relative flex shrink-0 ${props.size === "small" ? "w-6 h-6" : props.size === "large" ? "w-20 h-20" : "w-10 h-10"}`,
				props.class,
			)}
		>
			<img
				src={props.overrideSrc || props.user.avatar || FALLBACK_AVATAR}
				alt={props.nickname || props.user.displayName}
				onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
				loading="lazy"
				decoding="async"
				width={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				height={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				class={`rounded-full object-cover w-full h-full outline-card ${props.size === "small" ? "outline" : props.size === "large" ? "outline-4" : "outline-2"}`}
			/>
			<Show when={props.user.presence && !props.disableState}>
				<div
					class={`rounded-full absolute bottom-px right-px outline-background ${props.size === "small" ? "w-2 h-2 outline" : props.size === "large" ? "w-4 h-4 outline-4" : "w-2 h-2 outline-2"}`}
					classList={{
						"bg-green-500": props.user.presence?.onlineState === "online",
						"bg-yellow-500": props.user.presence?.onlineState === "away",
						"bg-red-500": props.user.presence?.onlineState === "dnd",
						"bg-neutral-500": props.user.presence?.onlineState === "offline",
					}}
				/>
			</Show>
		</div>
	);
}
