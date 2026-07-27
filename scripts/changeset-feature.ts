import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import {
	autocomplete,
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	outro,
	select,
	text,
} from "@clack/prompts";
import type { ReleaseNoteKind } from "../packages/lib/src/release-notes.ts";
import {
	appendWhatsNewBlock,
	kindForBump,
	parseChangesetFile,
} from "../packages/lib/src/release-notes.ts";
import {
	CHANGESET_DIR,
	CLIENT_PACKAGE,
	clientBump,
} from "./lib/changesets.ts";
import { iconLabel, supportsInlineImages } from "./lib/icon-preview.ts";
import { iconExists, searchIcons } from "./lib/icons.ts";

const MAX_ICON_RESULTS = 8;

const listChangesets = async (): Promise<Set<string>> => {
	const files = await readdir(CHANGESET_DIR);
	return new Set(files.filter((file) => file.endsWith(".md")));
};

const bail: (message: string) => never = (message) => {
	cancel(message);
	process.exit(130);
};

const required =
	(label: string) =>
	(value: string | undefined): string | undefined =>
		value && value.trim() !== "" ? undefined : `${label} is required.`;

const main = async () => {
	const before = await listChangesets();

	const added = spawnSync("pnpm", ["changeset", "add"], { stdio: "inherit" });
	if (added.status !== 0) {
		process.exitCode = added.status ?? 1;
		return;
	}

	const after = await listChangesets();
	const created = [...after].filter((file) => !before.has(file));

	if (created.length === 0) {
		console.log("\nNo changeset was created, nothing to announce.");
		return;
	}

	const name = created[0];
	const path = new URL(name, CHANGESET_DIR);
	const contents = await readFile(path, "utf8");
	const bump = clientBump(parseChangesetFile(contents));

	if (!bump) {
		console.log(
			`\nCreated .changeset/${name}. It does not touch ${CLIENT_PACKAGE}, so there is nothing to announce in-app.`,
		);
		return;
	}

	if (!process.stdin.isTTY) {
		console.log(
			`\nCreated .changeset/${name}. Run \`pnpm changeset:feature\` interactively to add a What's New entry.`,
		);
		return;
	}

	intro("What's New");

	const suggested = kindForBump(bump);

	const announce = await confirm({
		message: "Announce this change in-app?",
		initialValue: suggested === "feature",
	});
	if (isCancel(announce)) bail(`Left .changeset/${name} unchanged.`);

	if (!announce) {
		outro(`Left .changeset/${name} without a What's New entry.`);
		return;
	}

	const kind = await select<ReleaseNoteKind>({
		message: "Is this a feature or a fix?",
		initialValue: suggested,
		options: [
			{ value: "feature", label: "Feature", hint: "shown under New" },
			{ value: "fix", label: "Fix", hint: "shown under Fixed" },
		],
	});
	if (isCancel(kind)) bail(`Left .changeset/${name} unchanged.`);

	const title = await text({
		message: "Title",
		placeholder: "Voice channels",
		validate: required("A title"),
	});
	if (isCancel(title)) bail(`Left .changeset/${name} unchanged.`);

	const body = await text({
		message: "Body",
		placeholder: "Hop into a voice channel and talk without leaving the app.",
		validate: required("A body"),
	});
	if (isCancel(body)) bail(`Left .changeset/${name} unchanged.`);

	const previews = supportsInlineImages();
	if (!previews) {
		log.info(
			"Inline icon previews need a terminal with Kitty graphics support, such as Ghostty, Kitty or WezTerm.",
		);
	}

	const icon = await autocomplete<string>({
		message: "Icon",
		placeholder: "Type to search Phosphor icons",
		maxItems: MAX_ICON_RESULTS,
		filter: () => true,
		options() {
			const search = this.userInput.trim();
			const { matches, total } = searchIcons(
				search === "" ? "sparkle" : search,
				MAX_ICON_RESULTS,
			);

			if (matches.length === 0) {
				return [{ value: "", label: `No icons match "${search}"` }];
			}

			return matches.map((match, index) => ({
				value: match,
				label: iconLabel(match, previews),
				hint:
					index === 0 && total > matches.length
						? `${total} matches, keep typing to narrow`
						: undefined,
			}));
		},
		validate: (value) =>
			typeof value === "string" && iconExists(value)
				? undefined
				: "Pick an icon from the list.",
	});
	if (isCancel(icon)) bail(`Left .changeset/${name} unchanged.`);

	await writeFile(
		path,
		appendWhatsNewBlock(contents, {
			title: title.trim(),
			icon,
			body: body.trim(),
			kind,
		}),
	);

	outro(`Added a What's New entry to .changeset/${name}`);
};

await main();
