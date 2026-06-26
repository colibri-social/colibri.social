import {
	detectLanguage,
	highlight,
	normalizeLanguage,
} from "@arborium/arborium";
import { type Component, createResource, Show } from "solid-js";
import { CopyButton } from "../CopyButton";

/**
 * Renders a fenced code block with tree-sitter syntax highlighting via
 * arborium. Highlighting loads grammars from a CDN asynchronously, so we
 * show the plain (escaped) code immediately and swap in the highlighted
 * markup once it resolves.
 */
export const CodeBlock: Component<{ lang?: string; code: string }> = (
	props,
) => {
	const [highlighted] = createResource(
		() => [props.lang, props.code] as const,
		async ([lang, code]) => {
			const resolvedLang = lang
				? normalizeLanguage(lang)
				: detectLanguage(code);
			if (!resolvedLang) return null;
			try {
				return await highlight(resolvedLang, code);
			} catch {
				return null;
			}
		},
	);

	return (
		<pre
			data-facet-type="codeblock"
			class="bg-card rounded-md p-3 overflow-x-auto my-1 block group/codeblock"
		>
			<Show when={props.lang}>
				<div class="text-xs text-muted-foreground mb-1">{props.lang}</div>
			</Show>
			<div class="absolute top-2 right-2 opacity-0 group-hover/codeblock:opacity-100">
				<CopyButton value={props.code} />
			</div>
			<Show
				when={highlighted()}
				fallback={
					<code class="font-mono text-sm whitespace-pre">{props.code}</code>
				}
			>
				{(html) => (
					<code class="font-mono text-sm whitespace-pre" innerHTML={html()} />
				)}
			</Show>
		</pre>
	);
};
