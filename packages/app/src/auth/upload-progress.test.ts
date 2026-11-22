import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeXhr, lastXhr } from "./fake-xhr";
import {
	progressCallbackFor,
	registerUpload,
	throttleToFrames,
	UPLOAD_ID_HEADER,
	xhrFetch,
} from "./upload-progress";

const URL_ = "https://pds.test/xrpc/com.atproto.repo.uploadBlob";

const uploadRequest = () => {
	return new Request(URL_, {
		method: "POST",
		headers: {
			"content-type": "video/mp4",
			authorization: "DPoP token",
			[UPLOAD_ID_HEADER]: "7",
		},
		body: new Blob(["0123456789"]),
	});
};

const openedXhr = async () => {
	return vi.waitFor(() => lastXhr());
};

beforeEach(() => {
	FakeXhr.instances = [];
	vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("registerUpload", () => {
	it("hands out distinct ids and forgets them on release", () => {
		const first = registerUpload(() => {});
		const second = registerUpload(() => {});

		expect(first.id).not.toBe(second.id);
		expect(progressCallbackFor(first.id)).toBeTypeOf("function");

		first.release();

		expect(progressCallbackFor(first.id)).toBeUndefined();
		expect(progressCallbackFor(second.id)).toBeTypeOf("function");

		second.release();
	});
});

describe("xhrFetch", () => {
	it("sends method, url, headers and body, minus the upload id", async () => {
		const pending = xhrFetch(uploadRequest(), undefined, () => {});
		const xhr = await openedXhr();

		expect(xhr.method).toBe("POST");
		expect(xhr.url).toBe(URL_);
		expect(xhr.responseType).toBe("blob");
		expect(xhr.requestHeaders.get("content-type")).toBe("video/mp4");
		expect(xhr.requestHeaders.get("authorization")).toBe("DPoP token");
		expect(xhr.requestHeaders.has(UPLOAD_ID_HEADER)).toBe(false);
		expect(await (xhr.body as Blob).text()).toBe("0123456789");

		xhr.respond(200, "{}");
		await pending;
	});

	it("reports upload progress as a fraction", async () => {
		const fractions: number[] = [];
		const pending = xhrFetch(uploadRequest(), undefined, (fraction) =>
			fractions.push(fraction),
		);
		const xhr = await openedXhr();

		xhr.progress(0, 10);
		xhr.progress(4, 10);
		xhr.progress(10, 10);
		xhr.respond(200, "{}");
		await pending;

		expect(fractions).toEqual([0, 0.4, 1]);
	});

	it("maps status, status text, headers and body onto the response", async () => {
		const pending = xhrFetch(uploadRequest(), undefined, () => {});
		const xhr = await openedXhr();

		xhr.respond(
			401,
			'{"error":"use_dpop_nonce"}',
			'DPoP-Nonce: abc\r\nWWW-Authenticate: DPoP error="use_dpop_nonce"\r\n',
		);

		const response = await pending;

		expect(response.status).toBe(401);
		expect(response.headers.get("dpop-nonce")).toBe("abc");
		expect(response.headers.get("www-authenticate")).toBe(
			'DPoP error="use_dpop_nonce"',
		);
		expect(await response.json()).toEqual({ error: "use_dpop_nonce" });
	});

	it("rejects with a TypeError on a network error", async () => {
		const pending = xhrFetch(uploadRequest(), undefined, () => {});
		const xhr = await openedXhr();

		xhr.fail();

		await expect(pending).rejects.toBeInstanceOf(TypeError);
	});

	it("aborts the XHR and rejects with an AbortError", async () => {
		const controller = new AbortController();
		const pending = xhrFetch(uploadRequest(), controller.signal, () => {});
		const xhr = await openedXhr();

		controller.abort();

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(xhr.aborted).toBe(true);
	});

	it("rejects with the signal reason when it aborts with one", async () => {
		const controller = new AbortController();
		const pending = xhrFetch(uploadRequest(), controller.signal, () => {});

		await openedXhr();
		controller.abort(new DOMException("Request timed out", "TimeoutError"));

		await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
	});

	it("never opens an XHR for an already aborted signal", async () => {
		const controller = new AbortController();

		controller.abort();

		await expect(
			xhrFetch(uploadRequest(), controller.signal, () => {}),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(FakeXhr.instances).toHaveLength(0);
	});
});

describe("throttleToFrames", () => {
	it("delivers only the latest fraction per frame", () => {
		vi.useFakeTimers();

		const fractions: number[] = [];
		const progress = throttleToFrames((fraction) => fractions.push(fraction));

		progress.report(0.1);
		progress.report(0.2);
		progress.report(0.3);
		vi.advanceTimersByTime(20);
		progress.report(0.6);
		vi.advanceTimersByTime(20);

		expect(fractions).toEqual([0.3, 0.6]);
	});

	it("drops a pending frame on stop", () => {
		vi.useFakeTimers();

		const fractions: number[] = [];
		const progress = throttleToFrames((fraction) => fractions.push(fraction));

		progress.report(0.5);
		progress.stop();
		vi.advanceTimersByTime(20);

		expect(fractions).toEqual([]);
	});
});
