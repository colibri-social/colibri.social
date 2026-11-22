import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export const Video = (props: JSX.VideoHTMLAttributes<HTMLVideoElement>) => (
	<Dynamic component="video" {...props} />
);
