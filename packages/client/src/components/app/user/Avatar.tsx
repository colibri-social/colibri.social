import type { ActorData } from "@colibri-social/lib";
import { Show } from "solid-js";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { cx } from "../../../utils/cva";

const FALLBACK_AVATAR = "/user-placeholder.png";

/**
 * User avatar, with optional status indicator.
 */
export function Avatar(props: {
	user: ActorData;
	size?: "small" | "base" | "large";
	disableState?: boolean;
	/**
	 * Explicit image source, taking precedence over the resolved blob. Used to
	 * preview a not-yet-uploaded avatar (e.g. a local object URL during
	 * onboarding) where the actor has no stored blob ref yet.
	 */
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
				src={
					props.overrideSrc ||
					resolveBlob(
						props.user.did,
						props.user.data.avatar,
						props.size ?? "base",
					) ||
					FALLBACK_AVATAR
				}
				alt={props.user.data.displayName}
				onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
				loading="lazy"
				decoding="async"
				width={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				height={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				class={`rounded-full object-cover w-full h-full outline-card ${props.size === "small" ? "outline" : props.size === "large" ? "outline-4" : "outline-2"}`}
			/>
			<Show when={props.user.data?.onlineState && !props.disableState}>
				<div
					class={`rounded-full absolute bottom-px right-px outline-background ${props.size === "small" ? "w-2 h-2 outline" : props.size === "large" ? "w-4 h-4 outline-4" : "w-2 h-2 outline-2"}`}
					classList={{
						"bg-green-500": props.user.data.onlineState === "online",
						"bg-yellow-500": props.user.data.onlineState === "away",
						"bg-red-500": props.user.data.onlineState === "dnd",
						"bg-neutral-500": props.user.data.onlineState === "offline",
					}}
				/>
			</Show>
		</div>
	);
}
