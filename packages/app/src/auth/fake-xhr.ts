type Listener = ((event: ProgressEvent) => void) | null;

export class FakeXhr {
	static instances: FakeXhr[] = [];

	readonly upload: { onprogress: Listener } = { onprogress: null };
	readonly requestHeaders = new Headers();

	method = "";
	url = "";
	body: unknown;
	responseType = "";
	status = 0;
	statusText = "";
	response: unknown = null;
	responseHeaders = "";
	aborted = false;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	ontimeout: (() => void) | null = null;
	onabort: (() => void) | null = null;

	constructor() {
		FakeXhr.instances.push(this);
	}

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(key: string, value: string) {
		this.requestHeaders.set(key, value);
	}

	getAllResponseHeaders() {
		return this.responseHeaders;
	}

	send(body: unknown) {
		this.body = body;
	}

	abort() {
		this.aborted = true;
		this.onabort?.();
	}

	progress(loaded: number, total: number) {
		this.upload.onprogress?.({
			lengthComputable: true,
			loaded,
			total,
		} as ProgressEvent);
	}

	respond(status: number, body: string, headers = "") {
		this.status = status;
		this.statusText = status === 200 ? "OK" : "";
		this.response = new Blob([body]);
		this.responseHeaders = headers;
		this.onload?.();
	}

	fail() {
		this.onerror?.();
	}
}

export const lastXhr = () => {
	const xhr = FakeXhr.instances.at(-1);

	if (!xhr) throw new Error("No XMLHttpRequest was opened");

	return xhr;
};
