import {
	createEffect,
	createSignal,
	type JSX,
	mergeProps,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import {
	appActive,
	isAnimatedSource,
	reducedMotionActive,
} from "../../utils/playback";

export type PlayOnDemand = "hover" | "none";

export type AnimatedImageProps = JSX.ImgHTMLAttributes<HTMLImageElement> & {
	animated?: boolean;
	playOnDemand?: PlayOnDemand;
	play?: boolean;
	ref?: (element: HTMLImageElement) => void;
};

const MAX_FRAME_EDGE = 2048;

const IMAGE_ONLY_PROPS = [
	"src",
	"srcset",
	"sizes",
	"loading",
	"decoding",
	"crossOrigin",
	"referrerPolicy",
	"alt",
	"width",
	"height",
	"draggable",
	"onLoad",
	"onError",
	"style",
] as const;

const hideStyle = (
	style: JSX.CSSProperties | string | undefined,
	hidden: boolean,
): JSX.CSSProperties | string | undefined => {
	if (!hidden) return style;
	if (typeof style === "string") return `${style};display:none`;
	return { ...style, display: "none" };
};

const drawFrame = (canvas: HTMLCanvasElement, image: HTMLImageElement) => {
	const scale = Math.min(
		1,
		MAX_FRAME_EDGE / Math.max(image.naturalWidth, image.naturalHeight, 1),
	);
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
	canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
};

export const AnimatedImage = (props: AnimatedImageProps) => {
	const merged = mergeProps({ playOnDemand: "hover" as PlayOnDemand }, props);
	const [local, imageProps, shared] = splitProps(
		merged,
		["animated", "playOnDemand", "play", "ref"],
		IMAGE_ONLY_PROPS,
	);
	const [image, setImage] = createSignal<HTMLImageElement>();
	const [loadedSrc, setLoadedSrc] = createSignal<string>();
	const [demand, setDemand] = createSignal(false);
	let disposed = false;
	onCleanup(() => {
		disposed = true;
	});

	const candidate = () => local.animated ?? isAnimatedSource(imageProps.src);
	const paused = () =>
		candidate() &&
		(!appActive() || (reducedMotionActive() && !local.play && !demand()));
	const frameSrc = () => {
		const src = imageProps.src;
		return paused() && src && loadedSrc() === src ? src : undefined;
	};

	const markLoaded = (element: HTMLImageElement) => {
		if (disposed) return;
		if (element.complete && element.naturalWidth > 0) {
			setLoadedSrc(imageProps.src);
		}
	};

	createEffect(() => {
		const element = image();
		const host = element?.parentElement;
		if (!host || local.playOnDemand !== "hover" || !candidate()) return;
		const start = (event: PointerEvent) => {
			if (event.pointerType === "mouse") setDemand(true);
		};
		const press = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") setDemand(true);
		};
		const release = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") setDemand(false);
		};
		const stop = () => setDemand(false);
		const focusIn = (event: FocusEvent) => {
			if ((event.target as HTMLElement).matches?.(":focus-visible")) {
				setDemand(true);
			}
		};
		host.addEventListener("pointerenter", start);
		host.addEventListener("pointerleave", stop);
		host.addEventListener("pointerdown", press);
		host.addEventListener("pointerup", release);
		host.addEventListener("pointercancel", stop);
		host.addEventListener("focusin", focusIn);
		host.addEventListener("focusout", stop);
		onCleanup(() => {
			host.removeEventListener("pointerenter", start);
			host.removeEventListener("pointerleave", stop);
			host.removeEventListener("pointerdown", press);
			host.removeEventListener("pointerup", release);
			host.removeEventListener("pointercancel", stop);
			host.removeEventListener("focusin", focusIn);
			host.removeEventListener("focusout", stop);
		});
	});

	return (
		<>
			<Show when={frameSrc()} keyed>
				{(src) => (
					<canvas
						{...(shared as JSX.CanvasHTMLAttributes<HTMLCanvasElement>)}
						ref={(canvas) => {
							const element = image();
							if (element?.src) drawFrame(canvas, element);
						}}
						role={imageProps.alt ? "img" : undefined}
						aria-label={imageProps.alt || undefined}
						aria-hidden={imageProps.alt ? undefined : "true"}
						data-animated-image="paused"
						data-src={src}
						style={imageProps.style}
					/>
				)}
			</Show>
			<img
				{...shared}
				ref={(element) => {
					setImage(element);
					local.ref?.(element);
					queueMicrotask(() => markLoaded(element));
				}}
				src={imageProps.src}
				srcset={imageProps.srcset}
				sizes={imageProps.sizes}
				loading={imageProps.loading}
				decoding={imageProps.decoding}
				crossOrigin={imageProps.crossOrigin}
				referrerPolicy={imageProps.referrerPolicy}
				alt={imageProps.alt}
				width={imageProps.width}
				height={imageProps.height}
				draggable={imageProps.draggable}
				data-animated-image={
					candidate() ? (frameSrc() ? "hidden" : "playing") : undefined
				}
				style={hideStyle(imageProps.style, !!frameSrc())}
				onLoad={(event) => {
					if (disposed) return;
					setLoadedSrc(imageProps.src);
					const handler = imageProps.onLoad;
					if (typeof handler === "function") handler(event);
				}}
				onError={(event) => {
					if (disposed) return;
					setLoadedSrc(undefined);
					const handler = imageProps.onError;
					if (typeof handler === "function") handler(event);
				}}
			/>
		</>
	);
};
