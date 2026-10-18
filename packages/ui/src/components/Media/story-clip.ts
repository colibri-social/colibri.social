import { createSignal, onMount } from "solid-js";

export type StoryClip = { src: string; poster: string; seconds: number };

const drawFrame = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	t: number,
) => {
	context.fillStyle = "#2d1b69";
	context.fillRect(0, 0, width, height);
	context.fillStyle = "#8e51ff";
	context.beginPath();
	context.arc(
		width / 2 + Math.sin(t * 3) * width * 0.3,
		height / 2,
		height * 0.13,
		0,
		Math.PI * 2,
	);
	context.fill();
	context.fillStyle = "rgb(255 255 255 / 0.85)";
	context.font = `600 ${Math.round(height * 0.08)}px sans-serif`;
	context.fillText(`${t.toFixed(1)}s`, width * 0.05, height * 0.14);
};

export const recordClip = async (
	seconds = 1.5,
	width = 640,
	height = 360,
): Promise<StoryClip | undefined> => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context || !("captureStream" in canvas) || !window.MediaRecorder)
		return undefined;
	drawFrame(context, width, height, 0);
	const poster = canvas.toDataURL("image/png");
	const stream = canvas.captureStream(30);
	const recorder = new MediaRecorder(stream);
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => chunks.push(event.data);
	const stopped = new Promise<void>((resolve) => {
		recorder.onstop = () => resolve();
	});
	recorder.start();
	const started = performance.now();
	await new Promise<void>((resolve) => {
		const draw = (now: number) => {
			const t = (now - started) / 1000;
			drawFrame(context, width, height, t);
			if (t < seconds) requestAnimationFrame(draw);
			else resolve();
		};
		requestAnimationFrame(draw);
	});
	recorder.stop();
	await stopped;
	return {
		src: URL.createObjectURL(new Blob(chunks, { type: "video/webm" })),
		poster,
		seconds,
	};
};

const cache = new Map<number, Promise<StoryClip | undefined>>();

export const sharedClip = (seconds = 1.5) => {
	let clip = cache.get(seconds);
	if (!clip) {
		clip = recordClip(seconds);
		cache.set(seconds, clip);
	}
	return clip;
};

export const createStoryClip = (seconds = 1.5) => {
	const [clip, setClip] = createSignal<StoryClip>();
	onMount(async () => setClip(await sharedClip(seconds)));
	return clip;
};
