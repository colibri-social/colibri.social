import {
	createEffect,
	createSignal,
	type JSX,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { HeadphonesSlashIcon, MicrophoneSlashIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { getImageTint, tintGradient } from "../../utils/image-tint";
import { Avatar, type AvatarSize, type Presence } from "../Avatar/Avatar";

export type VoiceParticipant = {
	id: string;
	name: string;
	avatarSrc?: string;
	color?: string;
	presence?: Presence;
	speaking?: boolean;
	muted?: boolean;
	deafened?: boolean;
	serverMuted?: boolean;
	serverDeafened?: boolean;
};

export const speakingRingClass =
	"transition-[box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-out reduced-motion:transition-none motion-reduce:transition-none";

export type SpeakingAvatarProps = {
	name: string;
	src?: string;
	color?: string;
	presence?: Presence;
	speaking?: boolean;
	size?: AvatarSize;
	pixels?: number;
	class?: string;
};

export const SpeakingAvatar = (props: SpeakingAvatarProps) => (
	<span
		aria-hidden="true"
		data-speaking={props.speaking ? "" : undefined}
		class={cx(
			"relative inline-flex shrink-0 rounded-full",
			speakingRingClass,
			props.speaking
				? "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--primary)]"
				: "shadow-[0_0_0_2px_transparent,0_0_0_4px_transparent]",
			props.class,
		)}
		style={
			props.pixels
				? { width: `${props.pixels}px`, height: `${props.pixels}px` }
				: undefined
		}
	>
		<Avatar
			name={props.name}
			src={props.src}
			color={props.color}
			presence={props.presence}
			size={props.size ?? "md"}
			class={props.pixels ? "size-full! [&>span:first-child]:size-full" : ""}
		/>
	</span>
);

export type VoiceStateIconsProps = {
	muted?: boolean;
	deafened?: boolean;
	serverMuted?: boolean;
	serverDeafened?: boolean;
	size?: number;
	class?: string;
};

export const hasVoiceStateIcons = (state: VoiceStateIconsProps) =>
	!!(
		state.muted ||
		state.deafened ||
		state.serverMuted ||
		state.serverDeafened
	);

export const VoiceStateIcons = (props: VoiceStateIconsProps) => {
	const size = () => props.size ?? 16;
	const micOff = () => props.serverMuted || props.muted;
	const audioOff = () => props.serverDeafened || props.deafened;
	return (
		<Show when={micOff() || audioOff()}>
			<span class={cx("flex shrink-0 items-center gap-1", props.class)}>
				<Show when={micOff()}>
					<span
						role="img"
						aria-label={props.serverMuted ? "Muted by a moderator" : "Muted"}
						class={cx(
							"inline-flex",
							props.serverMuted ? "text-warning" : "text-destructive",
						)}
					>
						<MicrophoneSlashIcon size={size()} />
					</span>
				</Show>
				<Show when={audioOff()}>
					<span
						role="img"
						aria-label={
							props.serverDeafened ? "Deafened by a moderator" : "Deafened"
						}
						class={cx(
							"inline-flex",
							props.serverDeafened ? "text-warning" : "text-destructive",
						)}
					>
						<HeadphonesSlashIcon size={size()} />
					</span>
				</Show>
			</span>
		</Show>
	);
};

export const createTileFill = (
	source: () => { color?: string; tintFrom?: string },
) => {
	const [tint, setTint] = createSignal<string>();
	createEffect(() => {
		const { color, tintFrom } = source();
		setTint(undefined);
		if (color || !tintFrom) return;
		let active = true;
		onCleanup(() => {
			active = false;
		});
		void getImageTint(tintFrom).then((value) => {
			if (active) setTint(value);
		});
	});
	return () => {
		const { color } = source();
		if (color) return color;
		const value = tint();
		return value ? tintGradient(value) : undefined;
	};
};

export type VideoSurfaceProps = JSX.VideoHTMLAttributes<HTMLVideoElement> & {
	stream?: MediaStream;
	mirror?: boolean;
	fit?: "cover" | "contain";
};

export const VideoSurface = (props: VideoSurfaceProps) => {
	const [local, rest] = splitProps(props, ["stream", "mirror", "fit", "class"]);
	let video: HTMLVideoElement | undefined;
	createEffect(() => {
		const stream = local.stream;
		if (!video) return;
		if (video.srcObject !== (stream ?? null)) video.srcObject = stream ?? null;
		if (stream) void video.play().catch(() => {});
	});
	return (
		<video
			{...rest}
			ref={video}
			autoplay
			muted
			playsinline
			data-video-surface=""
			class={cx(
				"absolute inset-0 size-full bg-black",
				local.fit === "contain" ? "object-contain" : "object-cover",
				local.mirror && "-scale-x-100",
				local.class,
			)}
		/>
	);
};
