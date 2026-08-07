import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const CLI = fileURLToPath(
	new URL("../../node_modules/.bin/tailwindcss", import.meta.url),
);
const ENTRY = fileURLToPath(new URL("../embed.css", import.meta.url));

const GLOBAL_BY_DESIGN = [/^\.hb-/, /^\[data-marqy/, /^marqy-loop$/];

const NESTED_AT_RULE = /^@(media|supports|container|scope|starting-style)/;

type Rule = {
	selector: string;
	declarations: string;
	layer: string | undefined;
};

const splitSelector = (selector: string): Array<string> => {
	const branches: Array<string> = [];
	let depth = 0;
	let current = "";
	for (const character of selector) {
		if (character === "(" || character === "[") depth += 1;
		else if (character === ")" || character === "]") depth -= 1;
		if (character === "," && depth === 0) {
			branches.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	branches.push(current.trim());
	return branches.filter((branch) => branch.length > 0);
};

const collectRules = (css: string): Array<Rule> => {
	const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const rules: Array<Rule> = [];

	const walk = (input: string, layer: string | undefined): void => {
		let index = 0;
		let prelude = "";

		while (index < input.length) {
			const character = input[index];

			if (character === "{") {
				let depth = 1;
				let end = index + 1;
				while (end < input.length && depth > 0) {
					if (input[end] === "{") depth += 1;
					else if (input[end] === "}") depth -= 1;
					end += 1;
				}
				const selector = prelude.trim();
				const body = input.slice(index + 1, end - 1);
				const named = /^@layer\s+([a-z]+)$/.exec(selector);

				if (named) walk(body, named[1]);
				else if (NESTED_AT_RULE.test(selector)) walk(body, layer);
				else if (!selector.startsWith("@")) {
					rules.push({ selector, declarations: body, layer });
				}

				prelude = "";
				index = end;
				continue;
			}

			if (character === "}" || character === ";") {
				prelude = "";
				index += 1;
				continue;
			}

			prelude += character;
			index += 1;
		}
	};

	walk(source, undefined);
	return rules;
};

const definesOnlyCustomProperties = (declarations: string): boolean =>
	declarations
		.split(";")
		.map((declaration) => declaration.trim())
		.filter((declaration) => declaration.length > 0)
		.every((declaration) => declaration.startsWith("--"));

describe("embed.css", () => {
	const directory = mkdtempSync(`${tmpdir()}/colibri-embed-css-`);
	const output = `${directory}/embed.css`;
	execFileSync(CLI, ["-i", ENTRY, "-o", output, "--minify"], {
		stdio: "pipe",
	});
	const rules = collectRules(readFileSync(output, "utf8"));

	afterAll(() => rmSync(directory, { recursive: true, force: true }));

	it("emits rules", () => {
		expect(rules.length).toBeGreaterThan(1000);
	});

	it("scopes every rule that styles markup to the embed root", () => {
		const offenders = rules
			.filter((rule) =>
				splitSelector(rule.selector).some(
					(branch) => !branch.includes(".colibri-embed"),
				),
			)
			.filter((rule) => !definesOnlyCustomProperties(rule.declarations))
			.filter((rule) =>
				splitSelector(rule.selector).some(
					(branch) => !GLOBAL_BY_DESIGN.some((allowed) => allowed.test(branch)),
				),
			)
			.map((rule) => rule.selector);

		expect(offenders).toEqual([]);
	});

	it("keeps the generated utilities inside the utilities layer", () => {
		const utilities = rules.filter((rule) =>
			/^:where\(\.colibri-embed\) \.flex$/.test(rule.selector),
		);

		expect(utilities).toHaveLength(1);
		expect(utilities[0].layer).toBe("utilities");
	});
});
