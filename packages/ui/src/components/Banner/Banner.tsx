import {
	createEffect,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { getImageTint, tintGradient } from "../../utils/image-tint";
import { createSlot } from "../../utils/slot";

export type BannerRatio = "user" | "space";

export type BannerFill = "image" | "tint" | "color" | "placeholder";

export type BannerProps = {
	src?: string;
	alt?: string;
	tintFrom?: string;
	color?: string;
	ratio?: BannerRatio;
	class?: string;
	children?: JSX.Element;
};

const ratioClass: Record<BannerRatio, string> = {
	user: "aspect-[3/1]",
	space: "aspect-[2/1]",
};

type FillLayer = { id: number; background: string };

const fadeClass =
	"animate-[ui-fade-in_calc(240ms*var(--motion-scale))_var(--ease-out-quick)_both] motion-reduce:animate-none reduced-motion:animate-none";

export const Banner = (props: BannerProps) => {
	const children = createSlot(() => props.children);
	const [tint, setTint] = createSignal<string>();
	const [imageState, setImageState] = createSignal<
		"loading" | "loaded" | "failed"
	>("loading");
	const [layers, setLayers] = createSignal<FillLayer[]>([]);
	let nextLayerId = 0;

	createEffect(
		on(
			() => props.tintFrom,
			(url) => {
				setTint(undefined);
				if (!url) return;
				let active = true;
				onCleanup(() => {
					active = false;
				});
				void getImageTint(url).then((value) => {
					if (active) setTint(value);
				});
			},
		),
	);

	createEffect(
		on(
			() => props.src,
			() => setImageState("loading"),
		),
	);

	const background = () => {
		if (props.color) return props.color;
		const value = tint();
		return value ? tintGradient(value) : undefined;
	};

	createEffect(
		on(background, (value) => {
			if (!value) {
				setLayers([]);
				return;
			}
			const current = layers();
			if (current.at(-1)?.background === value) return;
			nextLayerId += 1;
			setLayers([...current.slice(-1), { id: nextLayerId, background: value }]);
		}),
	);

	const settleLayers = (id: number) => {
		setLayers((current) => current.filter((layer) => layer.id >= id));
	};

	const fill = (): BannerFill => {
		if (props.src && imageState() !== "failed") return "image";
		if (props.color) return "color";
		if (tint()) return "tint";
		return "placeholder";
	};

	return (
		<span
			data-banner=""
			data-fill={fill()}
			class={cx(
				"relative block w-full shrink-0 overflow-hidden bg-muted",
				ratioClass[props.ratio ?? "space"],
				props.class,
			)}
		>
			<For each={layers()}>
				{(layer) => (
					<span
						aria-hidden="true"
						data-banner-layer=""
						class={cx("absolute inset-0 block", fadeClass)}
						style={{ background: layer.background }}
						onAnimationEnd={() => settleLayers(layer.id)}
					/>
				)}
			</For>
			<Show
				when={props.src && imageState() !== "failed" ? props.src : undefined}
			>
				{(src) => (
					<img
						src={src()}
						alt={props.alt ?? ""}
						decoding="async"
						draggable={false}
						onLoad={() => setImageState("loaded")}
						onError={() => setImageState("failed")}
						class={cx(
							"absolute inset-0 size-full object-cover",
							"transition-opacity duration-[calc(240ms*var(--motion-scale))] ease-[var(--ease-out-quick)]",
							"motion-reduce:transition-none reduced-motion:transition-none",
							imageState() === "loaded" ? "opacity-100" : "opacity-0",
						)}
					/>
				)}
			</Show>
			<Show when={children.has()}>
				<span class="absolute inset-0 block">{children()}</span>
			</Show>
		</span>
	);
};
