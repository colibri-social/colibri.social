import "solid-js";

declare module "solid-js" {
	namespace JSX {
		interface IntrinsicElements {
			"marqy-loop": JSX.HTMLAttributes<HTMLElement> & {
				speed?: number | string;
				direction?: "left" | "right" | "up" | "down";
				"pause-on-hover"?: boolean;
				manual?: boolean;
			};
		}
	}
}
