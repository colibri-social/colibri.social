import "../src/styles/index.css";
import { action } from "storybook/actions";
import {
	createDecorator,
	createJSXDecorator,
	type Preview,
} from "storybook-solidjs-vite";
import { type Haptics, HapticsProvider } from "../src/utils/haptics";
import { installIconEffects } from "../src/utils/icon-fx";
import { installMotionTokens } from "../src/utils/motion";
import {
	applySafeAreaInsets,
	type SafeAreaInsets,
} from "../src/utils/safe-area";
import { withoutTransitions } from "../src/utils/theme";

installMotionTokens();
installIconEffects();

const storybookHaptics: Haptics = {
	impact: action("haptics.impact"),
	selection: action("haptics.selection"),
	notification: action("haptics.notification"),
};

const SAFE_AREA_PRESETS: Record<string, SafeAreaInsets | null> = {
	none: null,
	iphone: { top: 62, bottom: 34, left: 0, right: 0 },
	android: { top: 32, bottom: 24, left: 0, right: 0 },
	landscape: { top: 0, bottom: 21, left: 59, right: 59 },
};

const presetFor = (value: unknown) =>
	SAFE_AREA_PRESETS[typeof value === "string" ? value : "none"] ?? null;

const hatch =
	"repeating-linear-gradient(135deg, rgb(255 87 90 / 0.18) 0 6px, transparent 6px 12px)";

const SafeAreaOverlay = (props: { insets: SafeAreaInsets }) => (
	<div
		aria-hidden="true"
		data-safe-area-overlay=""
		style={{
			position: "fixed",
			inset: "0",
			"pointer-events": "none",
			"z-index": "2147483647",
		}}
	>
		<div
			style={{
				position: "absolute",
				top: "0",
				left: "0",
				right: "0",
				height: `${props.insets.top}px`,
				background: hatch,
			}}
		/>
		<div
			style={{
				position: "absolute",
				bottom: "0",
				left: "0",
				right: "0",
				height: `${props.insets.bottom}px`,
				background: hatch,
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: "0",
				bottom: "0",
				left: "0",
				width: `${props.insets.left}px`,
				background: hatch,
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: "0",
				bottom: "0",
				right: "0",
				width: `${props.insets.right}px`,
				background: hatch,
			}}
		/>
	</div>
);

const withRootFlags = createDecorator((Story, context) => {
	const root = document.documentElement;
	const theme = context.globals.theme ?? "dark";
	if (root.dataset.theme !== theme) {
		withoutTransitions(() => {
			root.dataset.theme = theme;
		});
	}
	root.dataset.slowMotion = String(context.globals.slowMotion === "on");
	root.dataset.reducedMotion = String(context.globals.reducedMotion === "on");
	const safeArea = String(context.globals.safeArea ?? "none");
	if (root.dataset.safeArea !== safeArea) {
		root.dataset.safeArea = safeArea;
		applySafeAreaInsets(presetFor(safeArea));
	}
	return Story();
});

const withProviders = createJSXDecorator((Story, context) => {
	const insets = presetFor(context.globals.safeArea);
	return (
		<HapticsProvider haptics={storybookHaptics}>
			<div class="min-h-dvh bg-background p-6 font-sans text-foreground">
				<Story />
			</div>
			{insets ? <SafeAreaOverlay insets={insets} /> : null}
		</HapticsProvider>
	);
});

export default {
	decorators: [withProviders, withRootFlags],
	globalTypes: {
		theme: {
			description: "Color theme",
			toolbar: {
				title: "Theme",
				icon: "contrast",
				items: [
					{ value: "dark", title: "Dark" },
					{ value: "light", title: "Light" },
				],
				dynamicTitle: true,
			},
		},
		slowMotion: {
			description: "Slow every animation down 5x",
			toolbar: {
				title: "Slow-mo",
				icon: "timer",
				items: [
					{ value: "off", title: "Normal speed" },
					{ value: "on", title: "Slow-mo (5x)" },
				],
				dynamicTitle: true,
			},
		},
		safeArea: {
			description: "Simulate device safe area insets",
			toolbar: {
				title: "Safe area",
				icon: "mobile",
				items: [
					{ value: "none", title: "No insets" },
					{ value: "iphone", title: "iPhone portrait (62 / 34)" },
					{ value: "android", title: "Android gesture nav (32 / 24)" },
					{ value: "landscape", title: "iPhone landscape (59 / 21)" },
				],
				dynamicTitle: true,
			},
		},
		reducedMotion: {
			description: "Force prefers-reduced-motion",
			toolbar: {
				title: "Reduced motion",
				icon: "accessibility",
				items: [
					{ value: "off", title: "Motion on" },
					{ value: "on", title: "Reduced motion" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: {
		theme: "dark",
		slowMotion: "off",
		reducedMotion: "off",
		safeArea: "none",
	},
	parameters: {
		layout: "fullscreen",
		backgrounds: { disable: true },
		viewport: {
			options: {
				iphone: {
					name: "iPhone (Figma 402x874)",
					styles: { width: "402px", height: "874px" },
					type: "mobile",
				},
			},
		},
		a11y: { test: "error" },
		controls: { expanded: true },
	},
} satisfies Preview;
