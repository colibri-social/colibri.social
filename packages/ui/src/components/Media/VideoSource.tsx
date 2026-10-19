import { createEffect, on } from "solid-js";

export const FIRST_FRAME_FRAGMENT = "#t=0.001";

const SIGNATURE_PARAMS = ["exp", "sig"];

export const firstFrameSrc = (src: string) => {
	if (!src || src.includes("#") || src.startsWith("data:")) return src;
	return `${src}${FIRST_FRAME_FRAGMENT}`;
};

export const mediaSourceKey = (src: string) => {
	if (!src.includes("?")) return src;
	let parsed: URL;
	try {
		parsed = new URL(src);
	} catch {
		return src;
	}
	for (const param of SIGNATURE_PARAMS) parsed.searchParams.delete(param);
	return parsed.toString();
};

export const sameMediaSource = (
	first: string | undefined,
	second: string | undefined,
) =>
	first === second ||
	(first !== undefined &&
		second !== undefined &&
		mediaSourceKey(first) === mediaSourceKey(second));

let probe: HTMLVideoElement | undefined;

export const playableType = (mimeType: string | undefined) => {
	if (!mimeType || typeof document === "undefined") return undefined;
	probe ??= document.createElement("video");
	return probe.canPlayType(mimeType) ? mimeType : undefined;
};

const lostSource = (media: HTMLMediaElement) =>
	media.error !== null ||
	media.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;

export const VideoSource = (props: {
	src: string;
	mimeType?: string;
	onError?: () => void;
}) => {
	let element: HTMLSourceElement | undefined;
	let loadedSrc = props.src;
	let loadedType = props.mimeType;
	createEffect(
		on(
			() => [props.src, props.mimeType] as const,
			([src, mimeType]) => {
				const parent = element?.parentElement;
				const media = parent instanceof HTMLMediaElement ? parent : undefined;
				const unchanged =
					sameMediaSource(loadedSrc, src) && loadedType === mimeType;
				if (unchanged && !(media && lostSource(media))) return;
				loadedSrc = src;
				loadedType = mimeType;
				media?.load();
			},
			{ defer: true },
		),
	);
	return (
		<source
			ref={element}
			src={firstFrameSrc(props.src)}
			type={playableType(props.mimeType)}
			onError={() => props.onError?.()}
		/>
	);
};
