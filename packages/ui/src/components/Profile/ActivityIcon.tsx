import { GamepadIcon } from "@solar-icons/solid/bold/gamepad";
import { MusicNoteIcon } from "@solar-icons/solid/bold/music-note";
import { StreamIcon } from "@solar-icons/solid/bold/stream";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";

const KIND_ICONS: Record<string, Component> = {
	listening: MusicNoteIcon,
	playing: GamepadIcon,
	streaming: StreamIcon,
};

export type ActivityIconProps = {
	kind?: string;
	class?: string;
};

export const ActivityIcon = (props: ActivityIconProps) => (
	<span
		aria-hidden="true"
		data-activity-icon={props.kind ?? "listening"}
		class={cx(
			"flex shrink-0 items-center justify-center [&>svg]:size-full",
			props.class,
		)}
	>
		<Dynamic
			component={KIND_ICONS[props.kind ?? "listening"] ?? MusicNoteIcon}
		/>
	</span>
);
