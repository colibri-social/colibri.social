import { z } from "astro/zod";
import { defineAction } from "astro:actions";

// TODO:
export const setCommunityOrder = defineAction({
	input: z.object({}),
	handler: async (input, context) => {},
});
