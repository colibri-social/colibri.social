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

export type SyncedAnimation = {
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

const cache = new Map<string, CacheEntry>();
const drawers = new Set<Drawer>();
const observed = new Map<Element, Drawer>();
let observer: IntersectionObserver | undefined;
let tick = 0;

export const canSyncAnimation = () => {
	return (
		typeof ImageDecoder !== "undefined" &&
		typeof createImageBitmap !== "undefined" &&
		typeof IntersectionObserver !== "undefined"
	);
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

const decodeFrames = async (bytes: Uint8Array, type: string) => {
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
	} catch {
		closeFrames(frames);

		return undefined;
	} finally {
		decoder.close();
	}

	const first = frames[0];

	if (!first || frames.length < 2) {
		closeFrames(frames);

		return undefined;
	}

	return {
		frames,
		timeline: frameTimeline(delays),
		width: first.width,
		height: first.height,
	};
};

const decodeAnimation = async (
	src: string,
): Promise<SyncedAnimation | undefined> => {
	try {
		const response = await fetch(src);

		if (!response.ok) return undefined;

		const bytes = new Uint8Array(await response.arrayBuffer());
		const type = imageType(bytes);

		if (!type || !isAnimatedImageData(bytes)) return undefined;
		if (!(await ImageDecoder.isTypeSupported(type))) return undefined;

		return await decodeFrames(bytes, type);
	} catch {
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
