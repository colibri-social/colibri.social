import type { APIContext } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined }));

const MANIFEST_URL = "https://example.test/latest.json";

const platforms = {
	"linux-x86_64": {
		url: "https://example.test/app.AppImage",
		signature: "s-default",
	},
	"linux-x86_64-appimage": {
		url: "https://example.test/app.AppImage",
		signature: "s-appimage",
	},
	"linux-x86_64-rpm": {
		url: "https://example.test/app.rpm",
		signature: "s-rpm",
	},
	"linux-x86_64-deb": {
		url: "https://example.test/app.deb",
		signature: "s-deb",
	},
	"darwin-aarch64": {
		url: "https://example.test/app.tar.gz",
		signature: "s-mac",
	},
};

const stubGithub = (tag: string, version: string) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			if (input.startsWith("https://api.github.com/")) {
				return Response.json([
					{
						draft: false,
						tag_name: tag,
						assets: [
							{ name: "latest.json", browser_download_url: MANIFEST_URL },
						],
					},
				]);
			}
			if (input === MANIFEST_URL) {
				return Response.json({ version, platforms });
			}
			return new Response(null, { status: 404 });
		}),
	);
};

const call = async (
	route: "stable" | "beta",
	params: { target: string; arch: string; version: string },
	query = "",
) => {
	const module =
		route === "stable"
			? await import("../pages/[target]/[arch]/[version].ts")
			: await import("../pages/beta/[target]/[arch]/[version].ts");
	const prefix = route === "beta" ? "/beta" : "";
	const url = new URL(
		`https://colibri.social${prefix}/${params.target}/${params.arch}/${params.version}${query}`,
	);
	return module.GET({ params, url } as unknown as APIContext);
};

const linux = { target: "linux", arch: "x86_64", version: "0.1.0" };

describe.each([
	{ route: "stable" as const, tag: "v1.0.0", version: "1.0.0" },
	{ route: "beta" as const, tag: "v1.0.0-spaces.3", version: "1.0.0-spaces.3" },
])("$route updater route", ({ route, tag, version }) => {
	beforeEach(() => {
		vi.resetModules();
		stubGithub(tag, version);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		["rpm", "https://example.test/app.rpm", "s-rpm"],
		["deb", "https://example.test/app.deb", "s-deb"],
		["appimage", "https://example.test/app.AppImage", "s-appimage"],
		["RPM", "https://example.test/app.rpm", "s-rpm"],
	])("serves the %s bundle when one is listed", async (bundle, url, signature) => {
		const res = await call(route, linux, `?bundle=${bundle}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ version, url, signature });
	});

	it.each([
		["no bundle", ""],
		["the unknown bundle", "?bundle=unknown"],
		["an unrecognized bundle", "?bundle=snap"],
	])("falls back to the target-arch key for %s", async (_label, query) => {
		const res = await call(route, linux, query);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ signature: "s-default" });
	});

	it("falls back when the bundle key is missing from the manifest", async () => {
		const res = await call(
			route,
			{ target: "darwin", arch: "aarch64", version: "0.1.0" },
			"?bundle=app",
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ signature: "s-mac" });
	});

	it("returns 404 for a platform the manifest lacks", async () => {
		const res = await call(
			route,
			{ target: "windows", arch: "x86_64", version: "0.1.0" },
			"?bundle=nsis",
		);
		expect(res.status).toBe(404);
	});

	it("returns 204 when the client is current", async () => {
		const res = await call(route, { ...linux, version }, "?bundle=rpm");
		expect(res.status).toBe(204);
	});
});
