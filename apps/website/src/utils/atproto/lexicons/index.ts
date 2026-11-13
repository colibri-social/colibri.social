import type { LexiconDoc } from "@atproto/lexicon";
import { Lexicons } from "@atproto/lexicon";

const modules = import.meta.glob<LexiconDoc>("./generated/*.json", {
	eager: true,
	import: "default",
});

export const LEXICON_DOCS: LexiconDoc[] = Object.values(modules)
	.filter((doc): doc is LexiconDoc => typeof doc?.id === "string")
	.sort((a, b) => a.id.localeCompare(b.id));

/**
 * A lexicon that can be used to validate records before inserting them:
 * ```ts
 * lexicon.assertValidRecord('social.colibri.community', { ... })
 * ```
 */
export const lexicon = new Lexicons();

for (const doc of LEXICON_DOCS) {
	lexicon.add(doc);
}
