import { invoke } from "@tauri-apps/api/core";
import { type Accessor, createSignal, onMount } from "solid-js";
import { isDesktopNative, isLinux } from "../../../utils/platform";

export type WindowControl = "minimize" | "maximize" | "close";

export type ControlsLayout = {
	side: Accessor<"left" | "right">;
	order: Accessor<Array<WindowControl>>;
};

const RENDERED: ReadonlyArray<WindowControl> = [
	"minimize",
	"maximize",
	"close",
];

const DEFAULT_ORDER: Array<WindowControl> = ["minimize", "maximize", "close"];

const isWindowControl = (value: string): value is WindowControl =>
	(RENDERED as ReadonlyArray<string>).includes(value);

const parseSide = (raw: string): Array<WindowControl> =>
	raw
		.split(",")
		.map((token) => token.trim())
		.filter(isWindowControl);

export const parseGnomeButtonLayout = (
	raw: string,
): { side: "left" | "right"; order: Array<WindowControl> } => {
	const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
	if (!trimmed) return { side: "right", order: DEFAULT_ORDER };

	const separator = trimmed.indexOf(":");
	if (separator === -1) {
		return { side: "right", order: parseSide(trimmed) };
	}

	const left = parseSide(trimmed.slice(0, separator));
	const right = parseSide(trimmed.slice(separator + 1));

	if (left.length > 0 && right.length === 0) {
		return { side: "left", order: left };
	}

	return { side: "right", order: right };
};

type TitlebarInfo = {
	buttonLayout: { left: Array<string>; right: Array<string> } | null;
};

export const createControlsLayout = (): ControlsLayout => {
	const [side, setSide] = createSignal<"left" | "right">("right");
	const [order, setOrder] = createSignal<Array<WindowControl>>(DEFAULT_ORDER);

	if (!isDesktopNative() || !isLinux()) {
		return { side, order };
	}

	onMount(() => {
		void invoke<TitlebarInfo>("titlebar_init")
			.then((info) => {
				const layout = info.buttonLayout;
				if (!layout) return;

				const left = layout.left.filter(isWindowControl);
				const right = layout.right.filter(isWindowControl);

				if (left.length > 0 && right.length === 0) {
					setSide("left");
					setOrder(left);
					return;
				}

				setSide("right");
				setOrder(right);
			})
			.catch(() => {});
	});

	return { side, order };
};
