import { spawnSync } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import {
	kindForBump,
	serializeWhatsNewBlock,
	WhatsNewError,
} from "../packages/lib/src/release-notes.ts";
import {
	CLIENT_PACKAGE,
	clientBump,
	listPendingChangesetFiles,
	readChangeset,
} from "./lib/changesets.ts";
import { iconProblem, searchIcons } from "./lib/icons.ts";

const FEATURE_BUMPS = ["minor", "major"];
const TITLE_LIMIT = 60;

interface Problem {
	file: string;
	message: string;
	suggestion?: string;
}

const git = (...args: Array<string>): string | undefined => {
	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) return undefined;
	return result.stdout;
};

const basename = (path: string): string =>
	path.replace(/^"|"$/g, "").slice(".changeset/".length);

const touchedChangesets = (): Array<string> | undefined => {
	if (process.argv.includes("--all")) return undefined;

	const base = process.env.GITHUB_BASE_REF
		? `origin/${process.env.GITHUB_BASE_REF}`
		: "origin/main";

	const merged = git("merge-base", base, "HEAD")?.trim();
	if (!merged) return undefined;

	const committed = git(
		"diff",
		"--name-only",
		"--diff-filter=AM",
		merged,
		"HEAD",
		"--",
		".changeset",
	);
	if (committed === undefined) return undefined;

	const working = git("status", "--porcelain", "--", ".changeset") ?? "";

	const files = new Set<string>();

	for (const line of committed.split("\n")) {
		const path = line.trim();
		if (path.endsWith(".md")) files.add(basename(path));
	}

	for (const line of working.split("\n")) {
		if (line.trim() === "") continue;
		const path = line.slice(3).trim();
		if (path.endsWith(".md")) files.add(basename(path));
	}

	return [...files].sort();
};

const shorten = (text: string): string => {
	if (text.length <= TITLE_LIMIT) return text;
	const clipped = text.slice(0, TITLE_LIMIT);
	const boundary = clipped.lastIndexOf(" ");
	return `${clipped.slice(0, boundary > 20 ? boundary : TITLE_LIMIT).trimEnd()}...`;
};

const nearestIcons = (name: string): Array<string> => {
	for (let length = name.length; length >= 3; length -= 1) {
		const matches = searchIcons(name.slice(0, length)).matches;
		if (matches.length > 0) return matches.slice(0, 3);
	}
	return [];
};

const suggestionFor = (summary: string, bump: string): string => {
	const firstLine = summary
		.split("\n")[0]
		.trim()
		.replace(/^(feat|fix|chore|refactor)(\([^)]*\))?:\s*/i, "");
	const firstSentence = firstLine.split(/(?<=\.)\s/)[0];
	const guess = searchIcons(firstLine.split(/\s+/)[0] ?? "").matches[0];

	return serializeWhatsNewBlock({
		title: shorten(firstLine),
		icon: guess ?? "sparkle-fill",
		body: firstSentence,
		platforms: ["all"],
		kind: kindForBump(bump),
	});
};

const main = async () => {
	const errors: Array<Problem> = [];
	const hints: Array<Problem> = [];

	const present = new Set(await listPendingChangesetFiles());
	const touched = touchedChangesets();
	const files =
		touched === undefined
			? [...present]
			: touched.filter((file) => present.has(file));

	if (touched === undefined) {
		console.log("Checking every pending changeset.");
	} else if (files.length === 0) {
		console.log("No changesets added or changed, nothing to check.");
		return;
	}

	for (const file of files) {
		let changeset: Awaited<ReturnType<typeof readChangeset>>;
		try {
			changeset = await readChangeset(file);
		} catch (error) {
			if (error instanceof WhatsNewError) {
				errors.push({ file, message: error.message });
				continue;
			}
			throw error;
		}

		const bump = clientBump(changeset);
		if (!bump) continue;

		if (changeset.block) {
			const problem = iconProblem(changeset.block.icon);
			if (problem) {
				const near = nearestIcons(changeset.block.icon);
				errors.push({
					file,
					message: `${problem}${near.length > 0 ? `, did you mean ${near.join(", ")}?` : ""}`,
				});
			}
			continue;
		}

		const problem: Problem = {
			file,
			message: `declares a ${bump} bump for ${CLIENT_PACKAGE} but has no What's New block`,
			suggestion: suggestionFor(changeset.summary, bump),
		};

		if (FEATURE_BUMPS.includes(bump)) errors.push(problem);
		else hints.push(problem);
	}

	for (const hint of hints) {
		console.log(`hint: .changeset/${hint.file}: ${hint.message}`);
	}

	for (const error of errors) {
		console.log(
			`::error file=.changeset/${error.file}::.changeset/${error.file}: ${error.message}`,
		);
		if (error.suggestion) {
			console.log(
				`\nAdd a block to .changeset/${error.file}, or run \`pnpm changeset:feature\` next time:\n\n${error.suggestion}\n`,
			);
		}
	}

	const report = buildReport(errors, hints);
	await writeSummary(report);
	await writeComment(report);

	if (errors.length > 0) {
		console.error(
			`\n${errors.length} What's New ${errors.length === 1 ? "problem" : "problems"} found.`,
		);
		process.exitCode = 1;
		return;
	}

	if (hints.length === 0) console.log("What's New entries look fine.");
};

const buildReport = (
	errors: Array<Problem>,
	hints: Array<Problem>,
): string | undefined => {
	if (errors.length === 0 && hints.length === 0) return undefined;

	const lines = ["## What's New", ""];

	if (errors.length > 0) {
		lines.push("These changesets have What's New problems:", "");
		for (const error of errors) {
			lines.push(`- \`.changeset/${error.file}\`: ${error.message}`);
		}
		lines.push("");
		for (const error of errors) {
			if (!error.suggestion) continue;
			lines.push(
				`<details><summary>Suggested block for <code>${error.file}</code></summary>`,
				"",
				"```md",
				error.suggestion,
				"```",
				"",
				"</details>",
				"",
			);
		}
	}

	if (hints.length > 0) {
		lines.push(
			"These fixes have no What's New block. That is fine, but if any of them is worth telling users about, add one:",
			"",
		);
		for (const hint of hints) {
			lines.push(`- \`.changeset/${hint.file}\``);
		}
		lines.push("");
	}

	lines.push(
		"Run `pnpm changeset:feature` to write a changeset with an entry interactively.",
		"",
		'Every block needs a `platforms:` line. Use `all` unless the change is only visible on some platforms, since the App Store does not let the iOS app show release notes for anything else.',
		"",
	);

	return lines.join("\n");
};

const writeSummary = async (report: string | undefined): Promise<void> => {
	const target = process.env.GITHUB_STEP_SUMMARY;
	if (!target || !report) return;
	await appendFile(target, report);
};

const writeComment = async (report: string | undefined): Promise<void> => {
	const target = process.env.WHATS_NEW_COMMENT_FILE;
	if (!target || !report) return;
	await writeFile(target, `<!-- whats-new-check -->\n\n${report}`);
};

await main();
