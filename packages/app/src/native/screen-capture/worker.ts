export const WIRE_PARSER_SOURCE = `
function parseMessage(buffer) {
	const view = new DataView(buffer);

	if (view.getUint8(0) === 1) {
		const channels = view.getUint8(1);
		const frames = view.getUint32(2, false);
		const samples = new Float32Array(buffer.slice(6));
		const planes = [];
		for (let channel = 0; channel < channels; channel += 1) {
			planes.push(samples.subarray(channel * frames, (channel + 1) * frames));
		}
		return { kind: "audio", frames, planes, buffer: samples.buffer };
	}

	return {
		kind: "video",
		type: (view.getUint8(1) & 1) === 1 ? "key" : "delta",
		timestamp: Number(view.getBigInt64(2, false)),
		data: new Uint8Array(buffer, 10),
	};
}

function decoderConfig(config) {
	const settings = {
		codec: config.codec,
		codedWidth: config.codedWidth,
		codedHeight: config.codedHeight,
		optimizeForLatency: true,
	};
	if (config.description) {
		settings.description = decodeBase64(config.description);
	}
	return settings;
}

function decodeBase64(value) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
`;

const WORKER_SHELL = `
let activeSocket = null;

self.onmessage = (event) => {
	if (event.data && event.data.type === "stop") {
		try { activeSocket?.close(); } catch {}
		return;
	}

	const { url, token, mode } = event.data;
	let decoder = null;
	let writer = null;
	let closed = false;

	const fail = (stage, message) => {
		if (closed) return;
		closed = true;
		try { decoder?.close(); } catch {}
		try { writer?.close(); } catch {}
		try { activeSocket?.close(); } catch {}
		self.postMessage({ type: "error", stage, message: String(message) });
	};

	const finish = () => {
		if (closed) return;
		closed = true;
		try { decoder?.close(); } catch {}
		try { writer?.close(); } catch {}
		self.postMessage({ type: "ended" });
	};

	const emit = (frame) => {
		if (mode === "main") {
			self.postMessage({ type: "frame", frame }, [frame]);
			return;
		}
		writer.write(frame).catch(() => {}).finally(() => frame.close());
	};

	if (mode === "main") {
		self.postMessage({ type: "ready" });
	} else {
		let generator;
		try {
			generator = new VideoTrackGenerator();
		} catch (error) {
			fail("bridge", error);
			return;
		}

		writer = generator.writable.getWriter();
		self.postMessage({ type: "track", track: generator.track }, [generator.track]);
	}

	const socket = new WebSocket(url + "?token=" + encodeURIComponent(token));
	socket.binaryType = "arraybuffer";
	activeSocket = socket;

	socket.onerror = () => fail("connection", "the capture connection failed");
	socket.onclose = () => finish();

	socket.onmessage = (message) => {
		if (typeof message.data === "string") {
			const config = JSON.parse(message.data);
			if (config.type !== "config") return;
			try { decoder?.close(); } catch {}
			decoder = new VideoDecoder({
				output: (frame) => emit(frame),
				error: (error) => fail("decode", error),
			});
			decoder.configure(decoderConfig(config));
			return;
		}

		const parsed = parseMessage(message.data);

		if (parsed.kind === "audio") {
			self.postMessage(
				{ type: "audio", frames: parsed.frames, planes: parsed.planes },
				[parsed.buffer],
			);
			return;
		}

		if (!decoder || decoder.state !== "configured") return;
		try {
			decoder.decode(new EncodedVideoChunk({
				type: parsed.type,
				timestamp: parsed.timestamp,
				data: parsed.data,
			}));
		} catch (error) {
			fail("decode", error);
		}
	};
};
`;

export const workerSource = (): string =>
	`${WIRE_PARSER_SOURCE}\n${WORKER_SHELL}`;
