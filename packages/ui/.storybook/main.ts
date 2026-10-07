import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "storybook-solidjs-vite";
import { mergeConfig } from "vite";

export default {
	framework: "storybook-solidjs-vite",
	stories: ["../src/**/*.stories.tsx"],
	addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
	viteFinal: (config) => mergeConfig(config, { plugins: [tailwindcss()] }),
} satisfies StorybookConfig;
