import { createEffect, on } from "solid-js";

export const FIRST_FRAME_FRAGMENT = "#t=0.001";

export const firstFrameSrc = (src: string) => {
	if (!src || src.includes("#") || src.startsWith("data:")) return src;
	return `${src}${FIRST_FRAME_FRAGMENT}`;
};

let probe: HTMLVideoElement | undefined;

export const playableType = (mimeType: string | undefined) => {
	if (!mimeType || typeof document === "undefined") return undefined;
	probe ??= document.createElement("video");
	return probe.canPlayType(mimeType) ? mimeType : undefined;
};

export const VideoSource = (props: {
	src: string;
	mimeType?: string;
	onError?: () => void;
}) => {
	let element: HTMLSourceElement | undefined;
	createEffect(
		on(
			() => [props.src, props.mimeType],
			() => {
				const parent = element?.parentElement;
				if (parent instanceof HTMLMediaElement) parent.load();
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
