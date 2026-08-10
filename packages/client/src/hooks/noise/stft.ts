export const FRAME_SIZE = 512;
export const HOP_SIZE = 256;
export const BIN_COUNT = FRAME_SIZE / 2 + 1;

class Fft {
	private readonly n: number;
	private readonly cos: Float32Array;
	private readonly sin: Float32Array;
	private readonly rev: Uint32Array;

	constructor(n: number) {
		this.n = n;
		const half = n >> 1;
		this.cos = new Float32Array(half);
		this.sin = new Float32Array(half);

		for (let i = 0; i < half; i += 1) {
			this.cos[i] = Math.cos((-2 * Math.PI * i) / n);
			this.sin[i] = Math.sin((-2 * Math.PI * i) / n);
		}

		const bits = Math.log2(n);
		this.rev = new Uint32Array(n);

		for (let i = 0; i < n; i += 1) {
			let r = 0;
			for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b);
			this.rev[i] = r;
		}
	}

	forward(re: Float32Array, im: Float32Array): void {
		const n = this.n;
		const { rev, cos, sin } = this;

		for (let i = 0; i < n; i += 1) {
			const j = rev[i];
			if (j > i) {
				let t = re[i];
				re[i] = re[j];
				re[j] = t;
				t = im[i];
				im[i] = im[j];
				im[j] = t;
			}
		}

		for (let size = 2; size <= n; size <<= 1) {
			const half = size >> 1;
			const step = n / size;

			for (let i = 0; i < n; i += size) {
				for (let j = i, k = 0; j < i + half; j += 1, k += step) {
					const c = cos[k];
					const s = sin[k];
					const tr = re[j + half] * c - im[j + half] * s;
					const ti = re[j + half] * s + im[j + half] * c;
					re[j + half] = re[j] - tr;
					im[j + half] = im[j] - ti;
					re[j] += tr;
					im[j] += ti;
				}
			}
		}
	}

	inverse(re: Float32Array, im: Float32Array): void {
		const n = this.n;
		for (let i = 0; i < n; i += 1) im[i] = -im[i];
		this.forward(re, im);
		for (let i = 0; i < n; i += 1) {
			re[i] /= n;
			im[i] = -im[i] / n;
		}
	}
}

export class SpectralStream {
	private readonly fft = new Fft(FRAME_SIZE);
	private readonly window = new Float32Array(FRAME_SIZE);
	private readonly denom = new Float32Array(HOP_SIZE);
	private readonly input = new Float32Array(FRAME_SIZE);
	private readonly overlap = new Float32Array(FRAME_SIZE);
	private readonly re = new Float32Array(FRAME_SIZE);
	private readonly im = new Float32Array(FRAME_SIZE);

	readonly spectrum = new Float32Array(BIN_COUNT * 2);

	constructor() {
		for (let i = 0; i < FRAME_SIZE; i += 1) {
			this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / FRAME_SIZE));
		}

		for (let i = 0; i < HOP_SIZE; i += 1) {
			const a = this.window[i];
			const b = this.window[i + HOP_SIZE];
			this.denom[i] = a * a + b * b || 1;
		}
	}

	analyse(hop: Float32Array): Float32Array {
		this.input.copyWithin(0, HOP_SIZE);
		this.input.set(hop, HOP_SIZE);

		for (let i = 0; i < FRAME_SIZE; i += 1) {
			this.re[i] = this.input[i] * this.window[i];
			this.im[i] = 0;
		}

		this.fft.forward(this.re, this.im);

		for (let i = 0; i < BIN_COUNT; i += 1) {
			this.spectrum[i * 2] = this.re[i];
			this.spectrum[i * 2 + 1] = this.im[i];
		}

		return this.spectrum;
	}

	synthesise(spectrum: Float32Array, out: Float32Array): void {
		for (let i = 0; i < BIN_COUNT; i += 1) {
			this.re[i] = spectrum[i * 2];
			this.im[i] = spectrum[i * 2 + 1];
		}

		for (let i = BIN_COUNT; i < FRAME_SIZE; i += 1) {
			const mirror = FRAME_SIZE - i;
			this.re[i] = this.re[mirror];
			this.im[i] = -this.im[mirror];
		}

		this.fft.inverse(this.re, this.im);

		for (let i = 0; i < FRAME_SIZE; i += 1) {
			this.overlap[i] += this.re[i] * this.window[i];
		}

		for (let i = 0; i < HOP_SIZE; i += 1) {
			out[i] = this.overlap[i] / this.denom[i];
		}

		this.overlap.copyWithin(0, HOP_SIZE);
		this.overlap.fill(0, HOP_SIZE);
	}
}
