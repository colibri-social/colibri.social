import { ColibriError } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeXhr, lastXhr } from "./fake-xhr";
import { createOAuthFetch } from "./fetch";
import { registerUpload, UPLOAD_ID_HEADER } from "./upload-progress";

const UPLOAD_URL = "https://pds.test/xrpc/com.atproto.repo.uploadBlob";

const uploadRequest = (id: string) => {
	return new Request(UPLOAD_URL, {
		method: "POST",
		headers: { "content-type": "image/png", [UPLOAD_ID_HEADER]: id },
		body: new Blob(["png"]),
	});
};

beforeEach(() => {
	FakeXhr.instances = [];
	vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("createOAuthFetch upload requests", () => {
	it("sends registered uploads through XHR without the id header", async () => {
		const base = vi.fn<typeof fetch>();
		const fractions: number[] = [];
		const upload = registerUpload((fraction) => fractions.push(fraction));
		const pending = createOAuthFetch(base)(uploadRequest(upload.id));
		const xhr = await vi.waitFor(() => lastXhr());

		xhr.progress(3, 3);
		xhr.respond(200, '{"blob":{}}');

		const response = await pending;

		expect(response.status).toBe(200);
		expect(xhr.requestHeaders.has(UPLOAD_ID_HEADER)).toBe(false);
		expect(fractions).toEqual([1]);
		expect(base).not.toHaveBeenCalled();

		upload.release();
	});

	it("strips the id header and uses fetch when no callback is registered", async () => {
		const base = vi.fn<typeof fetch>(async () => new Response("{}"));

		await createOAuthFetch(base)(uploadRequest("missing"));

		const [sent] = base.mock.calls[0] ?? [];

		expect(sent).toBeInstanceOf(Request);
		expect((sent as Request).headers.has(UPLOAD_ID_HEADER)).toBe(false);
		expect(FakeXhr.instances).toHaveLength(0);
	});

	it("aborts with Unreachable once progress stalls", async () => {
		vi.useFakeTimers();

		const upload = registerUpload(() => {});
		const pending = createOAuthFetch(vi.fn())(uploadRequest(upload.id));
		const settled = pending.catch((error: unknown) => error);

		await vi.waitFor(() => lastXhr());

		const xhr = lastXhr();

		await vi.advanceTimersByTimeAsync(20_000);
		xhr.progress(1, 3);
		await vi.advanceTimersByTimeAsync(20_000);

		expect(xhr.aborted).toBe(false);

		await vi.advanceTimersByTimeAsync(10_000);

		const error = await settled;

		expect(xhr.aborted).toBe(true);
		expect(error).toBeInstanceOf(ColibriError);
		expect((error as ColibriError).code).toBe("Unreachable");

		upload.release();
	});

	it("waits longer for the response once every byte is sent", async () => {
		vi.useFakeTimers();

		const upload = registerUpload(() => {});
		const pending = createOAuthFetch(vi.fn())(uploadRequest(upload.id));

		await vi.waitFor(() => lastXhr());

		const xhr = lastXhr();

		xhr.progress(3, 3);
		await vi.advanceTimersByTimeAsync(45_000);

		expect(xhr.aborted).toBe(false);

		xhr.respond(200, "{}");

		expect((await pending).status).toBe(200);

		upload.release();
	});

	it("forwards an abort from the request signal", async () => {
		const upload = registerUpload(() => {});
		const controller = new AbortController();
		const request = new Request(uploadRequest(upload.id), {
			signal: controller.signal,
		});
		const pending = createOAuthFetch(vi.fn())(request);
		const xhr = await vi.waitFor(() => lastXhr());

		controller.abort();

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(xhr.aborted).toBe(true);

		upload.release();
	});
});

describe("createOAuthFetch token detection", () => {
	it("never reads a non-form request body", async () => {
		const base = vi.fn<typeof fetch>(async () => new Response("{}"));
		const request = new Request(UPLOAD_URL, {
			method: "POST",
			headers: { "content-type": "video/mp4" },
			body: new Blob(["video"]),
		});
		const clone = vi.spyOn(request, "clone");

		await createOAuthFetch(base)(request);

		expect(clone).not.toHaveBeenCalled();
	});

	it("still reads form bodies to detect token requests", async () => {
		const base = vi.fn<typeof fetch>(async () => new Response("{}"));
		const request = new Request("https://auth.test/oauth/token", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "grant_type=refresh_token",
		});
		const clone = vi.spyOn(request, "clone");

		await createOAuthFetch(base)(request);

		expect(clone).toHaveBeenCalled();
	});
});
