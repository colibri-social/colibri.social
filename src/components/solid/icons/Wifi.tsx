import { cn } from "@/utils/cn";
import { ConnectionQuality } from "livekit-client";
import { Match, Switch, type Component } from "solid-js";

export const Wifi: Component<{
	className?: string;
	size?: number;
	quality: ConnectionQuality;
}> = (props) => (
	<Switch>
		<Match when={props.quality === ConnectionQuality.Unknown}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={cn("text-foreground", props.className)}
			>
				<path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204ZM237.08,87A172,172,0,0,0,18.92,87,8,8,0,0,0,29.08,99.37a156,156,0,0,1,197.84,0A8,8,0,0,0,237.08,87ZM205,122.77a124,124,0,0,0-153.94,0A8,8,0,0,0,61,135.31a108,108,0,0,1,134.06,0,8,8,0,0,0,11.24-1.3A8,8,0,0,0,205,122.77Zm-32.26,35.76a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"></path>
			</svg>
		</Match>
		<Match when={props.quality === ConnectionQuality.Excellent}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={cn("text-green-400", props.className)}
			>
				<path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204ZM237.08,87A172,172,0,0,0,18.92,87,8,8,0,0,0,29.08,99.37a156,156,0,0,1,197.84,0A8,8,0,0,0,237.08,87ZM205,122.77a124,124,0,0,0-153.94,0A8,8,0,0,0,61,135.31a108,108,0,0,1,134.06,0,8,8,0,0,0,11.24-1.3A8,8,0,0,0,205,122.77Zm-32.26,35.76a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"></path>
			</svg>
		</Match>
		<Match when={props.quality === ConnectionQuality.Good}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={cn("text-lime-400", props.className)}
			>
				<path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204Zm65-81.23a124,124,0,0,0-153.94,0A8,8,0,0,0,61,135.31a108,108,0,0,1,134.06,0,8,8,0,0,0,11.24-1.3A8,8,0,0,0,205,122.77Zm-32.26,35.76a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"></path>
			</svg>
		</Match>
		<Match when={props.quality === ConnectionQuality.Poor}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={cn("text-red-400", props.className)}
			>
				<path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204Zm32.71-45.47a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"></path>
			</svg>
		</Match>
		<Match when={props.quality === ConnectionQuality.Lost}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={cn("text-muted-foreground", props.className)}
			>
				<path d="M229.66,98.34a8,8,0,0,1-11.32,11.32L200,91.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L188.69,80,170.34,61.66a8,8,0,0,1,11.32-11.32L200,68.69l18.34-18.35a8,8,0,0,1,11.32,11.32L211.31,80ZM128,192a12,12,0,1,0,12,12A12,12,0,0,0,128,192Zm44.71-33.47a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94ZM135.62,64.18a8,8,0,1,0,.76-16c-2.78-.13-5.6-.2-8.38-.2A172.35,172.35,0,0,0,18.92,87,8,8,0,1,0,29.08,99.37,156.25,156.25,0,0,1,128,64C130.53,64,133.09,64.06,135.62,64.18Zm-.16,48.07a8,8,0,1,0,1.08-16c-2.83-.19-5.7-.29-8.54-.29a122.74,122.74,0,0,0-77,26.77A8,8,0,0,0,56,137a7.93,7.93,0,0,0,5-1.73A106.87,106.87,0,0,1,128,112C130.48,112,133,112.08,135.46,112.25Z"></path>
			</svg>
		</Match>
	</Switch>
);
