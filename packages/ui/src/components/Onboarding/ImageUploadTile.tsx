import { createMemo, Show, splitProps } from "solid-js";
import { AnimatedAddIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { createPress } from "../../utils/press";

const DASH = 8;
const STROKE = 2;

export type ImageUploadTileProps = {
	label: string;
	src?: string;
	accept?: string;
	shape?: "square" | "circle";
	size?: number;
	disabled?: boolean;
	onFileChange?: (file: File) => void;
	class?: string;
};

export const ImageUploadTile = (props: ImageUploadTileProps) => {
	const [local, rest] = splitProps(props, [
		"label",
		"src",
		"accept",
		"shape",
		"size",
		"disabled",
		"onFileChange",
		"class",
	]);
	let input: HTMLInputElement | undefined;
	const size = () => local.size ?? 96;
	const radius = () => (local.shape === "circle" ? size() / 2 : 16);
	const { pressed, pressProps } = createPress<HTMLButtonElement>({
		disabled: () => local.disabled,
	});

	const outline = createMemo(() => {
		const side = size() - STROKE;
		const corner = Math.max(0, radius() - STROKE / 2);
		const perimeter = 4 * (side - 2 * corner) + 2 * Math.PI * corner;
		const periods = Math.max(1, Math.round(perimeter / (DASH * 2)));
		return { side, corner, pathLength: periods * DASH * 2 };
	});

	const onInputChange = (
		event: Event & { currentTarget: HTMLInputElement },
	) => {
		const file = event.currentTarget.files?.[0];
		if (file) local.onFileChange?.(file);
		event.currentTarget.value = "";
	};

	return (
		<div
			class={cx("relative inline-flex shrink-0", local.class)}
			style={{ width: `${size()}px`, height: `${size()}px` }}
		>
			<button
				{...rest}
				{...pressProps}
				type="button"
				aria-label={local.label}
				disabled={local.disabled}
				data-icon-host=""
				data-pressed={pressed() || undefined}
				data-shape={local.shape ?? "square"}
				data-has-image={local.src ? "" : undefined}
				onClick={() => input?.click()}
				class={cx(
					"group/upload pressable relative size-full cursor-pointer text-accent outline-none",
					"hover:text-muted-foreground",
					"focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
					"disabled:cursor-not-allowed disabled:opacity-50",
				)}
				style={{ "border-radius": `${radius()}px` }}
			>
				<Show
					when={local.src}
					fallback={
						<svg
							aria-hidden="true"
							class="absolute inset-0 size-full"
							viewBox={`0 0 ${size()} ${size()}`}
							fill="none"
						>
							<rect
								x={STROKE / 2}
								y={STROKE / 2}
								width={outline().side}
								height={outline().side}
								rx={outline().corner}
								stroke="currentColor"
								stroke-width={STROKE}
								stroke-dasharray={`${DASH} ${DASH}`}
								pathLength={outline().pathLength}
							/>
						</svg>
					}
				>
					{(src) => (
						<img
							src={src()}
							alt=""
							class="absolute inset-0 size-full object-cover"
							style={{ "border-radius": `${radius()}px` }}
						/>
					)}
				</Show>
				<span
					aria-hidden="true"
					data-upload-badge=""
					class={cx(
						"absolute flex size-6 items-center justify-center rounded-full bg-primary text-white",
						local.shape === "circle"
							? "top-0.5 right-0.5"
							: "-top-[5px] -right-1.5",
					)}
				>
					<AnimatedAddIcon trigger="press" size={16} />
				</span>
			</button>
			<input
				ref={input}
				type="file"
				accept={local.accept ?? "image/*"}
				tabIndex={-1}
				aria-hidden="true"
				class="hidden"
				disabled={local.disabled}
				onChange={onInputChange}
			/>
		</div>
	);
};
