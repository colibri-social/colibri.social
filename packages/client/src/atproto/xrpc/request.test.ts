import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();

vi.mock("../../errors/report", () => ({
	reportError: (err: unknown, options: unknown) => reportError(err, options),
}));

const { request } = await import("./request");

const respondWith = (status: number, body: string) => async () =>
	new Response(body, { status, headers: { "content-type": "text/plain" } });

const forbidden = respondWith(
	403,
	JSON.stringify({
		error: "Forbidden",
		message: "caller is not a member of this community",
	}),
);

beforeEach(() => reportError.mockClear());

describe("request", () => {
	it("does not report a failure the caller declared as expected", async () => {
		const res = await request(forbidden, {
			lxm: "social.colibri.channel.listUnreadStatus",
			route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
			expected: ["Forbidden"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("reports a failure the caller did not declare", async () => {
		const res = await request(forbidden, {
			lxm: "social.colibri.channel.listUnreadStatus",
			route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
			expected: ["InvalidRequest"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});

	it("classifies the envelope code even when the status disagrees", async () => {
		const res = await request(
			respondWith(
				502,
				JSON.stringify({ error: "Forbidden", message: "not a member" }),
			),
			{
				lxm: "social.colibri.channel.listUnreadStatus",
				route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
				expected: ["Forbidden"],
			},
		);

		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error.code).toBe("Forbidden");
			expect(res.error.status).toBe(502);
		}
		expect(reportError).not.toHaveBeenCalled();
	});
});
