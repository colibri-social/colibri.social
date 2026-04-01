import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const documents = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/documents" }),
	schema: z.object({
		eyebrow: z.string(),
		title: z.string(),
		description: z.string(),
	}),
});

const docs = defineCollection({ loader: docsLoader(), schema: docsSchema() });

export const collections = {
	documents,
	docs,
};
