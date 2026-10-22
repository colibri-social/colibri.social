import { afterEach, expect, it } from "vitest";
import { setLatency } from "../../data/mock/source";
import {
	articleWithText,
	cleanupMounted,
	main,
	mount,
	until,
	wait,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
	setLatency(0);
});

const devFeed = (store: Awaited<ReturnType<typeof mount>>["store"]) => {
	const hq = store.communities
		.value()
		?.find((entry) => entry.did === "did:plc:colibrihqspace2a4b6c8d");
	if (!hq) throw new Error("hq missing");
	const dev = store.space(hq).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	return store.channel(dev.space);
};

const paintedCanvas = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 48;
	const context = canvas.getContext("2d");
	if (context) {
		context.fillStyle = "#3a7";
		context.fillRect(0, 0, 64, 48);
	}
	return { canvas, context };
};

const videoFile = async () => {
	const { canvas, context } = paintedCanvas();
	const stream = canvas.captureStream(30);
	const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => chunks.push(event.data);
	const stopped = new Promise((resolve) => {
		recorder.onstop = resolve;
	});
	recorder.start();
	for (let frame = 0; frame < 12; frame++) {
		if (context) {
			context.fillStyle = frame % 2 ? "#a37" : "#3a7";
			context.fillRect(0, 0, 64, 48);
		}
		await wait(30);
	}
	recorder.stop();
	await stopped;
	return new File(chunks, "clip.webm", { type: "video/webm" });
};

const thumbnail = async () => {
	const { canvas } = paintedCanvas();
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(value) => (value ? resolve(value) : reject(new Error("no blob"))),
			"image/png",
		),
	);
	return URL.createObjectURL(blob);
};

const watchForErrors = (row: () => HTMLElement | undefined) => {
	let seen = false;
	const observer = new MutationObserver(() => {
		if (row()?.querySelector("[data-media-error]")) seen = true;
	});
	observer.observe(main(), { childList: true, subtree: true });
	return {
		seen: () => seen || !!row()?.querySelector("[data-media-error]"),
		stop: () => observer.disconnect(),
	};
};

it("never shows a load error on a video that is still sending", async () => {
	const { store } = await mount();
	const feed = devFeed(store);
	const file = await videoFile();
	setLatency(900);
	const row = () => {
		const root = main();
		return root ? articleWithText(root, "Pending clip") : undefined;
	};
	const errors = watchForErrors(row);
	const sent = feed.send({
		text: "Pending clip",
		files: [{ file, previewSrc: await thumbnail() }],
	});
	await until(() => !!row()?.querySelector("[data-media-tile]"));
	expect(row()?.dataset.state).toBe("pending");
	await wait(700);
	expect(errors.seen()).toBe(false);
	errors.stop();
	await sent;
});

it("never shows a load error on a video sent before its thumbnail is ready", async () => {
	const { store } = await mount();
	const feed = devFeed(store);
	const file = await videoFile();
	setLatency(900);
	const row = () => {
		const root = main();
		return root ? articleWithText(root, "Clip without a thumbnail") : undefined;
	};
	const errors = watchForErrors(row);
	const sent = feed.send({
		text: "Clip without a thumbnail",
		files: [{ file }],
	});
	await until(() => !!row()?.querySelector("[data-media-tile]"));
	await wait(700);
	expect(errors.seen()).toBe(false);
	errors.stop();
	await sent;
});
