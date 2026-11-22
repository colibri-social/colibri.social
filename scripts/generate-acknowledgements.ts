import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Ecosystem = "npm" | "rust";

interface Library {
	name: string;
	version: string;
	license?: string;
	href?: string;
	ecosystem: Ecosystem;
}

interface Acknowledgements {
	libraries: Array<Library>;
}

interface PnpmLicenseEntry {
	name: string;
	versions: Array<string>;
	paths: Array<string>;
	license?: string;
	homepage?: string;
}

interface CargoPackage {
	id: string;
	name: string;
	version: string;
	license: string | null;
	repository: string | null;
	homepage: string | null;
	source: string | null;
}

interface CargoNode {
	id: string;
	deps: Array<{
		pkg: string;
		dep_kinds: Array<{ kind: string | null }>;
	}>;
}

interface CargoMetadata {
	packages: Array<CargoPackage>;
	resolve: { root: string | null; nodes: Array<CargoNode> } | null;
	workspace_members: Array<string>;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(
	ROOT,
	"packages/app/src/screens/settings/acknowledgements.generated.json",
);
const RUST_MANIFEST_DIR = join(ROOT, "packages/wrapper/src-tauri");
const NPM_PACKAGES = [
	"@colibri-social/app",
	"@colibri-social/ui",
	"@colibri-social/lib",
];
const OWN_SCOPE = "@colibri-social/";
const UNKNOWN_LICENSES = new Set(["Unknown", "UNKNOWN", "UNLICENSED", ""]);

const run = (command: string, args: Array<string>, cwd = ROOT) => {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	});
	if (result.error) return { ok: false as const, reason: result.error.message };
	if (result.status !== 0)
		return {
			ok: false as const,
			reason: result.stderr.trim().split("\n").slice(-3).join(" "),
		};
	return { ok: true as const, stdout: result.stdout };
};

const cleanUrl = (value: string | null | undefined): string | undefined => {
	if (!value) return undefined;
	const trimmed = value
		.trim()
		.replace(/^git\+/, "")
		.replace(/^(git|ssh):\/\/(git@)?/, "https://")
		.replace(/\.git(#.*)?$/, "")
		.replace(/#readme$/, "");
	return /^https?:\/\//.test(trimmed) ? trimmed : undefined;
};

const cleanLicense = (value: string | null | undefined): string | undefined => {
	const trimmed = value?.trim();
	if (!trimmed || UNKNOWN_LICENSES.has(trimmed)) return undefined;
	return trimmed.replace(/\s*\/\s*/g, " OR ");
};

const repositoryOf = (packageDir: string | undefined): string | undefined => {
	if (!packageDir) return undefined;
	try {
		const manifest = JSON.parse(
			readFileSync(join(packageDir, "package.json"), "utf8"),
		) as { repository?: string | { url?: string } };
		const repository = manifest.repository;
		if (typeof repository === "string")
			return /^[\w.-]+\/[\w.-]+$/.test(repository)
				? `https://github.com/${repository}`
				: cleanUrl(repository.replace(/^github:/, "https://github.com/"));
		return cleanUrl(
			repository?.url?.replace(/^git@github\.com:/, "https://github.com/"),
		);
	} catch {
		return undefined;
	}
};

const npmLibraries = (): Array<Library> | undefined => {
	const filters = NPM_PACKAGES.flatMap((name) => ["--filter", name]);
	const result = run("pnpm", [
		...filters,
		"licenses",
		"list",
		"--json",
		"--prod",
	]);
	if (!result.ok) {
		console.warn(`[acknowledgements] pnpm licenses failed: ${result.reason}`);
		return undefined;
	}
	const groups = JSON.parse(result.stdout) as Record<
		string,
		Array<PnpmLicenseEntry>
	>;
	const libraries: Array<Library> = [];
	for (const entries of Object.values(groups)) {
		for (const entry of entries) {
			if (entry.name.startsWith(OWN_SCOPE)) continue;
			entry.versions.forEach((version, index) => {
				libraries.push({
					name: entry.name,
					version,
					license: cleanLicense(entry.license),
					href:
						repositoryOf(entry.paths[index]) ??
						cleanUrl(entry.homepage) ??
						`https://www.npmjs.com/package/${entry.name}`,
					ecosystem: "npm",
				});
			});
		}
	}
	return libraries;
};

const shippedCrateIds = (metadata: CargoMetadata): Set<string> => {
	const nodes = new Map(
		(metadata.resolve?.nodes ?? []).map((node) => [node.id, node]),
	);
	const roots = metadata.resolve?.root
		? [metadata.resolve.root]
		: metadata.workspace_members;
	const seen = new Set<string>();
	const queue = [...roots];
	while (queue.length > 0) {
		const id = queue.pop();
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		for (const dep of nodes.get(id)?.deps ?? []) {
			if (dep.dep_kinds.some((kind) => kind.kind === null)) queue.push(dep.pkg);
		}
	}
	return seen;
};

const rustLibraries = (): Array<Library> | undefined => {
	const result = run(
		"cargo",
		["metadata", "--format-version", "1", "--locked"],
		RUST_MANIFEST_DIR,
	);
	if (!result.ok) {
		console.warn(`[acknowledgements] cargo metadata failed: ${result.reason}`);
		return undefined;
	}
	const metadata = JSON.parse(result.stdout) as CargoMetadata;
	const shipped = shippedCrateIds(metadata);
	const members = new Set(metadata.workspace_members);
	return metadata.packages
		.filter((crate) => shipped.has(crate.id) && !members.has(crate.id))
		.filter((crate) => crate.source !== null || crate.repository !== null)
		.map((crate) => ({
			name: crate.name,
			version: crate.version,
			license: cleanLicense(crate.license),
			href:
				cleanUrl(crate.repository) ??
				cleanUrl(crate.homepage) ??
				`https://crates.io/crates/${crate.name}`,
			ecosystem: "rust" as const,
		}));
};

const readExisting = async (): Promise<Acknowledgements> => {
	try {
		return JSON.parse(await readFile(OUTPUT, "utf8")) as Acknowledgements;
	} catch {
		return { libraries: [] };
	}
};

const dedupe = (libraries: Array<Library>): Array<Library> => {
	const byKey = new Map<string, Library>();
	for (const library of libraries)
		byKey.set(
			`${library.ecosystem}:${library.name}@${library.version}`,
			library,
		);
	return [...byKey.values()].sort(
		(a, b) =>
			a.ecosystem.localeCompare(b.ecosystem) ||
			a.name.localeCompare(b.name) ||
			a.version.localeCompare(b.version, undefined, { numeric: true }),
	);
};

const main = async () => {
	const existing = await readExisting();
	const keep = (ecosystem: Ecosystem) =>
		existing.libraries.filter((library) => library.ecosystem === ecosystem);
	const npm = npmLibraries() ?? keep("npm");
	const rust = rustLibraries() ?? keep("rust");
	const next: Acknowledgements = { libraries: dedupe([...npm, ...rust]) };
	const serialized = `${JSON.stringify(next, null, "\t")}\n`;
	const current = await readFile(OUTPUT, "utf8").catch(() => "");
	if (serialized === current) return;
	await writeFile(OUTPUT, serialized);
	const count = (ecosystem: Ecosystem) =>
		next.libraries.filter((library) => library.ecosystem === ecosystem).length;
	console.log(
		`[acknowledgements] wrote ${count("npm")} npm and ${count("rust")} Rust libraries`,
	);
};

await main();
