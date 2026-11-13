import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	splitProps,
} from "solid-js";
import { isAnimatedImageData } from "../../utils/animation-sniff";
import {
	type FrameTimeline,
	fitFrameSize,
	frameAt,
	frameDelayMs,
	frameTimeline,
} from "./frame-clock";
import { decodeWithScript } from "./script-decode";

export type SyncedAnimationDecoder = "native" | "script";

export type SyncedAnimationDecoderPreference = "auto" | "script";

export type SyncedAnimation = {
	decoder: SyncedAnimationDecoder;
	frames: ImageBitmap[];
	timeline: FrameTimeline;
	width: number;
	height: number;
};

type CacheEntry = {
	refs: number;
	released: boolean;
	result: Promise<SyncedAnimation | undefined>;
	releaseTimer?: ReturnType<typeof setTimeout>;
};

type Drawer = { visible: boolean; draw: (now: number) => void };

const MAX_FRAMES = 300;
const MAX_SIDE = 256;
const RELEASE_DELAY_MS = 2_000;

const log = createLogger("emoji");
const cache = new Map<string, CacheEntry>();
const drawers = new Set<Drawer>();
const observed = new Map<Element, Drawer>();
let observer: IntersectionObserver | undefined;
let tick = 0;
let decoderPreference: SyncedAnimationDecoderPreference = "auto";

export const setSyncedAnimationDecoder = (
	preference: SyncedAnimationDecoderPreference,
) => {
	decoderPreference = preference;
};

const canSyncAnimation = () => {
	return (
		typeof createImageBitmap !== "undefined" &&
		typeof IntersectionObserver !== "undefined"
	);
};

const nativeDecoderSupports = async (type: string) => {
	if (decoderPreference === "script") return false;
	if (typeof ImageDecoder === "undefined") return false;

	return await ImageDecoder.isTypeSupported(type);
};

const imageType = (bytes: Uint8Array) => {
	const head = String.fromCharCode(...bytes.subarray(0, 12));

	if (head.startsWith("GIF")) return "image/gif";
	if (head.slice(1, 4) === "PNG") return "image/png";
	if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") {
		return "image/webp";
	}

	return undefined;
};

const closeFrames = (frames: readonly ImageBitmap[]) => {
	for (const frame of frames) frame.close();
};

const finishAnimation = (
	decoder: SyncedAnimationDecoder,
	frames: ImageBitmap[],
	delays: readonly number[],
): SyncedAnimation | undefined => {
	const first = frames[0];

	if (!first || frames.length < 2) {
		closeFrames(frames);

		return undefined;
	}

	return {
		decoder,
		frames,
		timeline: frameTimeline(delays),
		width: first.width,
		height: first.height,
	};
};

const decodeNative = async (bytes: Uint8Array, type: string) => {
	const decoder = new ImageDecoder({ data: bytes, type });
	const frames: ImageBitmap[] = [];
	const delays: number[] = [];

	try {
		await decoder.tracks.ready;
		await decoder.completed;

		const count = Math.min(
			decoder.tracks.selectedTrack?.frameCount ?? 0,
			MAX_FRAMES,
		);

		for (let index = 0; index < count; index++) {
			const { image } = await decoder.decode({ frameIndex: index });
			const size = fitFrameSize(
				image.displayWidth,
				image.displayHeight,
				MAX_SIDE,
			);

			try {
				frames.push(
					await createImageBitmap(image, {
						resizeWidth: size.width,
						resizeHeight: size.height,
						resizeQuality: "high",
					}),
				);
				delays.push(frameDelayMs(image.duration));
			} finally {
				image.close();
			}
		}
	} catch (error) {
		closeFrames(frames);

		throw error;
	} finally {
		decoder.close();
	}

	return finishAnimation("native", frames, delays);
};

const decodeScript = async (bytes: Uint8Array, type: string) => {
	const animation = decodeWithScript(bytes, type, MAX_FRAMES);

	if (!animation) return undefined;

	const { width, height } = animation;
	const size = fitFrameSize(width, height, MAX_SIDE);
	const frames: ImageBitmap[] = [];
	const delays: number[] = [];

	try {
		for (const frame of animation.frames) {
			frames.push(
				await createImageBitmap(new ImageData(frame.pixels, width, height), {
					resizeWidth: size.width,
					resizeHeight: size.height,
					resizeQuality: "high",
				}),
			);
			delays.push(frameDelayMs(frame.delayMs * 1000));
		}
	} catch (error) {
		closeFrames(frames);

		throw error;
	}

	return finishAnimation("script", frames, delays);
};

const fetchImage = async (src: string) => {
	try {
		const response = await fetch(src);

		if (response.ok) return new Uint8Array(await response.arrayBuffer());

		log.warn("fetching an animated emoji failed", {
			code: classifyThrown(response).code,
		});
	} catch (error) {
		log.warn("fetching an animated emoji failed", {
			code: classifyThrown(error).code,
		});
	}

	return undefined;
};

const decodeAnimation = async (
	src: string,
): Promise<SyncedAnimation | undefined> => {
	const bytes = await fetchImage(src);
	const type = bytes && imageType(bytes);

	if (!bytes || !type || !isAnimatedImageData(bytes)) return undefined;

	try {
		if (await nativeDecoderSupports(type)) {
			return await decodeNative(bytes, type);
		}

		return await decodeScript(bytes, type);
	} catch (error) {
		log.warn("decoding an animated emoji failed", {
			code: classifyThrown(error).code,
		});

		return undefined;
	}
};

const acquireAnimation = (src: string) => {
	const existing = cache.get(src);

	if (existing) {
		clearTimeout(existing.releaseTimer);
		existing.releaseTimer = undefined;
		existing.refs += 1;

		return existing.result;
	}

	const entry: CacheEntry = {
		refs: 1,
		released: false,
		result: decodeAnimation(src),
	};

	cache.set(src, entry);
	void entry.result.then((animation) => {
		if (entry.released && animation) closeFrames(animation.frames);
	});

	return entry.result;
};

const releaseAnimation = (src: string) => {
	const entry = cache.get(src);

	if (!entry) return;

	entry.refs -= 1;

	if (entry.refs > 0) return;

	clearTimeout(entry.releaseTimer);
	entry.releaseTimer = setTimeout(() => {
		if (entry.refs > 0 || cache.get(src) !== entry) return;

		cache.delete(src);
		entry.released = true;
		void entry.result.then((animation) => {
			if (animation) closeFrames(animation.frames);
		});
	}, RELEASE_DELAY_MS);
};

const run = (now: number) => {
	let active = false;

	for (const drawer of drawers) {
		if (!drawer.visible) continue;

		drawer.draw(now);
		active = true;
	}

	tick = active ? requestAnimationFrame(run) : 0;
};

const wake = () => {
	if (tick) return;

	for (const drawer of drawers) {
		if (drawer.visible) {
			tick = requestAnimationFrame(run);

			return;
		}
	}
};

const visibilityObserver = () => {
	observer ??= new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const drawer = observed.get(entry.target);

			if (drawer) drawer.visible = entry.isIntersecting;
		}

		wake();
	});

	return observer;
};

const register = (element: Element, drawer: Drawer) => {
	drawers.add(drawer);
	observed.set(element, drawer);
	visibilityObserver().observe(element);

	return () => {
		drawers.delete(drawer);
		observed.delete(element);
		observer?.unobserve(element);
	};
};

export const createSyncedAnimation = (src: () => string | undefined) => {
	const [animation, setAnimation] = createSignal<SyncedAnimation>();

	createEffect(
		on(src, (current) => {
			setAnimation(undefined);

			if (!current || !canSyncAnimation()) return;

			let active = true;

			void acquireAnimation(current).then((result) => {
				if (active) setAnimation(result);
			});
			onCleanup(() => {
				active = false;
				releaseAnimation(current);
			});
		}),
	);

	return animation;
};

export type SyncedAnimationCanvasProps = Omit<
	JSX.CanvasHTMLAttributes<HTMLCanvasElement>,
	"ref" | "width" | "height"
> & {
	animation: SyncedAnimation;
	[attribute: `data-${string}`]: string | undefined;
};

export const SyncedAnimationCanvas = (props: SyncedAnimationCanvasProps) => {
	const [local, attributes] = splitProps(props, ["animation"]);

	const attach = (canvas: HTMLCanvasElement) => {
		const context = canvas.getContext("2d");
		let shown = -1;
		let drawn: SyncedAnimation | undefined;

		const draw = (now: number) => {
			const animation = local.animation;
			const index = frameAt(animation.timeline, now);
			const frame = animation.frames[index];

			if (!context || !frame || (drawn === animation && shown === index)) {
				return;
			}

			if (drawn !== animation) {
				canvas.width = animation.width;
				canvas.height = animation.height;
			}

			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(frame, 0, 0, canvas.width, canvas.height);
			shown = index;
			drawn = animation;
		};

		draw(performance.now());
		onCleanup(register(canvas, { visible: false, draw }));
	};

	return <canvas {...attributes} ref={attach} />;
};
