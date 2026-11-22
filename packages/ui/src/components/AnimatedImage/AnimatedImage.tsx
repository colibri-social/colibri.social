import {
	createEffect,
	createSignal,
	type JSX,
	mergeProps,
	on,
	onCleanup,
	Show,
	splitProps,
	untrack,
} from "solid-js";
import {
	freshAnimationUrl,
	sniffAnimation,
	sniffLoopDuration,
} from "../../utils/animation-sniff";
import { bindPlayDemand } from "../../utils/play-demand";
import {
	appActive,
	isAnimatedSource,
	reducedMotionActive,
} from "../../utils/playback";

export type PlayOnDemand = "hover" | "none";

export type AnimatedImagePlayback = "auto" | "demand";

export const MEDIA_PLAY_HOST = "data-media-play-host";

export type AnimatedImageProps = JSX.ImgHTMLAttributes<HTMLImageElement> & {
	animated?: boolean;
	playOnDemand?: PlayOnDemand;
	playback?: AnimatedImagePlayback;
	frameSize?: number;
	play?: boolean;
	maxLoops?: number;
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

const pixelRatio = () =>
	typeof devicePixelRatio === "number" ? Math.max(1, devicePixelRatio) : 1;

const drawFrame = (
	canvas: HTMLCanvasElement,
	image: HTMLImageElement,
	frameSize?: number,
) => {
	const width = Math.max(image.naturalWidth, 1);
	const height = Math.max(image.naturalHeight, 1);
	const context = () => {
		const found = canvas.getContext("2d");
		if (found) found.imageSmoothingQuality = "high";
		return found;
	};
	if (frameSize) {
		const side = Math.min(width, height);
		const edge = Math.max(
			1,
			Math.round(Math.min(side, frameSize * pixelRatio(), MAX_FRAME_EDGE)),
		);
		canvas.width = edge;
		canvas.height = edge;
		context()?.drawImage(
			image,
			(width - side) / 2,
			(height - side) / 2,
			side,
			side,
			0,
			0,
			edge,
			edge,
		);
		return;
	}
	const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(width, height));
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	context()?.drawImage(image, 0, 0, canvas.width, canvas.height);
};

const playHostOf = (element: HTMLImageElement, demandOnly: boolean) =>
	(demandOnly
		? element.parentElement?.closest<HTMLElement>(`[${MEDIA_PLAY_HOST}]`)
		: undefined) ?? element.parentElement;

export const AnimatedImage = (props: AnimatedImageProps) => {
	const merged = mergeProps({ playOnDemand: "hover" as PlayOnDemand }, props);
	const [local, imageProps, shared] = splitProps(
		merged,
		[
			"animated",
			"playOnDemand",
			"playback",
			"frameSize",
			"play",
			"maxLoops",
			"ref",
		],
		IMAGE_ONLY_PROPS,
	);
	const [image, setImage] = createSignal<HTMLImageElement>();
	const [loadedSrc, setLoadedSrc] = createSignal<string>();
	const [demand, setDemand] = createSignal(false);
	let disposed = false;
	onCleanup(() => {
		disposed = true;
	});

	const [stillSrc, setStillSrc] = createSignal<string>();
	createEffect(() => {
		const src = imageProps.src;
		if (!src || local.animated !== true || isAnimatedSource(src)) return;
		void sniffAnimation(src).then((animated) => {
			if (!disposed && animated === false && imageProps.src === src)
				setStillSrc(src);
		});
	});
	const candidate = () =>
		(local.animated ?? isAnimatedSource(imageProps.src)) &&
		stillSrc() !== imageProps.src;
	const [loopMs, setLoopMs] = createSignal<number>();
	const [exhausted, setExhausted] = createSignal(false);
	const [replaySrc, setReplaySrc] = createSignal<string>();
	const shownSrc = () => replaySrc() ?? imageProps.src;
	const releaseReplay = () => {
		const previous = replaySrc();
		setReplaySrc(undefined);
		if (previous) URL.revokeObjectURL(previous);
	};
	onCleanup(() => {
		const current = untrack(replaySrc);
		if (current) URL.revokeObjectURL(current);
	});
	createEffect(() => {
		const src = imageProps.src;
		const limit = local.maxLoops;
		setLoopMs(undefined);
		setExhausted(false);
		untrack(releaseReplay);
		if (!src || !limit || !candidate()) return;
		void sniffLoopDuration(src).then((ms) => {
			if (!disposed && imageProps.src === src) setLoopMs(ms);
		});
	});

	const demandOnly = () => local.playback === "demand";
	const paused = () =>
		candidate() &&
		(!appActive() ||
			((demandOnly() || reducedMotionActive() || exhausted()) &&
				!local.play &&
				!demand()));
	const frameSrc = () => {
		const src = imageProps.src;
		return paused() && src && loadedSrc() === shownSrc() ? src : undefined;
	};

	createEffect(() => {
		const ms = loopMs();
		const limit = local.maxLoops;
		if (!ms || !limit || exhausted() || paused()) return;
		if (loadedSrc() !== shownSrc()) return;
		const timer = setTimeout(() => setExhausted(true), ms * limit);
		onCleanup(() => clearTimeout(timer));
	});

	createEffect(
		on(
			demand,
			(wanted) => {
				const src = imageProps.src;
				if (!wanted || !exhausted() || !src) return;
				void freshAnimationUrl(src).then((url) => {
					if (!url) return;
					if (disposed || imageProps.src !== src || !demand()) {
						URL.revokeObjectURL(url);
						return;
					}
					const previous = replaySrc();
					setReplaySrc(url);
					if (previous) URL.revokeObjectURL(previous);
				});
			},
			{ defer: true },
		),
	);

	let announcedSrc: string | undefined;
	const announceLoad = (event: Event) => {
		if (disposed) return;
		const src = imageProps.src;
		setLoadedSrc(shownSrc());
		if (announcedSrc === src) return;
		announcedSrc = src;
		const handler = imageProps.onLoad;
		if (typeof handler === "function")
			handler(
				event as Event & {
					currentTarget: HTMLImageElement;
					target: Element;
				},
			);
	};

	const markLoaded = (element: HTMLImageElement) => {
		if (disposed) return;
		const src = shownSrc();
		if (!src || (src === imageProps.src && announcedSrc === src)) return;
		if (element.getAttribute("src") !== src) return;
		if (element.complete && element.naturalWidth > 0) {
			element.dispatchEvent(new Event("load"));
		}
	};

	createEffect(
		on(
			shownSrc,
			() => {
				const element = image();
				if (element) queueMicrotask(() => markLoaded(element));
			},
			{ defer: true },
		),
	);

	const [placed, setPlaced] = createSignal<HTMLImageElement>();
	createEffect(() => {
		const element = image();
		if (!element || element.isConnected) {
			setPlaced(element);
			return;
		}
		queueMicrotask(() => {
			if (!disposed) setPlaced(element);
		});
	});

	createEffect(() => {
		const element = placed();
		if (!element) return;
		const host = playHostOf(element, demandOnly());
		const hoverable = local.playOnDemand === "hover" || !!local.maxLoops;
		if (!host || !hoverable || !candidate()) return;
		onCleanup(bindPlayDemand(host, setDemand));
	});

	return (
		<>
			<Show when={frameSrc()} keyed>
				{(src) => (
					<canvas
						{...(shared as JSX.CanvasHTMLAttributes<HTMLCanvasElement>)}
						ref={(canvas) => {
							createEffect(() => {
								const element = image();
								if (element?.src) drawFrame(canvas, element, local.frameSize);
							});
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
				src={shownSrc()}
				srcset={replaySrc() ? undefined : imageProps.srcset}
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
				onLoad={announceLoad}
				onError={(event) => {
					if (disposed) return;
					announcedSrc = undefined;
					setLoadedSrc(undefined);
					const handler = imageProps.onError;
					if (typeof handler === "function") handler(event);
				}}
			/>
		</>
	);
};
