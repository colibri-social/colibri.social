import { createSignal, Show } from "solid-js";
import { cx } from "../../utils/cx";

export type SpaceIconSize = 48 | 64;

export type SpaceIconProps = {
	name: string;
	src?: string;
	size?: SpaceIconSize;
	class?: string;
};

const sizeClass: Record<SpaceIconSize, string> = {
	48: "size-12 rounded-control text-base",
	64: "size-16 rounded-surface text-xl",
};

export const spaceInitials = (name: string) =>
	name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
		.join("");

export const SpaceIcon = (props: SpaceIconProps) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<span
			data-space-icon=""
			class={cx(
				"relative flex shrink-0 items-center justify-center overflow-hidden bg-secondary font-bold text-muted-foreground select-none",
				sizeClass[props.size ?? 48],
				props.class,
			)}
		>
			<Show
				when={props.src && !failed() ? props.src : undefined}
				fallback={<span aria-hidden="true">{spaceInitials(props.name)}</span>}
			>
				{(src) => (
					<img
						src={src()}
						alt=""
						decoding="async"
						draggable={false}
						onError={() => setFailed(true)}
						class="size-full object-cover"
					/>
				)}
			</Show>
		</span>
	);
};
