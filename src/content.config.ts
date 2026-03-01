import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const documents = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/data/documents" }),
	schema: z.object({
		eyebrow: z.string(),
		title: z.string(),
		description: z.string(),
	}),
});

export const collections = { documents };
