import { defineConfig } from "cva";
import { extendTailwindMerge } from "tailwind-merge";

const safeValues = ["safe", (value: string) => /^safe-offset-\d+$/.test(value)];

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			pt: [{ pt: safeValues }],
			pb: [{ pb: safeValues }],
			pl: [{ pl: safeValues }],
			pr: [{ pr: safeValues }],
			px: [{ px: safeValues }],
			py: [{ py: ["safe"] }],
			top: [{ top: safeValues }],
			bottom: [{ bottom: safeValues }],
		},
		theme: {
			radius: [
				"control-xs",
				"control-sm",
				"control",
				"control-lg",
				"checkbox",
				"badge",
				"surface",
				"sheet",
			],
			shadow: ["overlay"],
		},
	},
});

export const { cva, cx, compose } = defineConfig({
	hooks: {
		onComplete: (className) => twMerge(className),
	},
});

export type { VariantProps } from "cva";
