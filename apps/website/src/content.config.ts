import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const documents = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/documents" }),
	schema: z.object({
		eyebrow: z.string(),
		title: z.string(),
		description: z.string(),
	}),
});

const faq = defineCollection({
	loader: file("./src/content/faq.yaml"),
	schema: z.object({
		question: z.string(),
		answer: z.string(),
	}),
});

const docs = defineCollection({ loader: docsLoader(), schema: docsSchema() });

export const collections = {
	documents,
	faq,
	docs,
};
