import { createRandom } from "./seed";

let minimum = 80;
let maximum = 260;
const random = createRandom(0x1a7e);

let scale = 1;
let pending = 0;

export const pendingLatency = () => pending;

export const setLatencyScale = (next: number) => {
	scale = Math.max(1, next);
};

export const latencyScale = () => scale;

export const setLatency = (min: number, max = min) => {
	minimum = Math.max(0, min);
	maximum = Math.max(minimum, max);
};

export const withLatency = <T>(produce: () => T): Promise<T> => {
	if (maximum <= 0) {
		try {
			return Promise.resolve(produce());
		} catch (error) {
			return Promise.reject(error);
		}
	}
	const wait = random.int(minimum, maximum) * scale;
	pending += 1;
	return new Promise<T>((resolve, reject) => {
		setTimeout(() => {
			pending -= 1;
			try {
				resolve(produce());
			} catch (error) {
				reject(error);
			}
		}, wait);
	});
};
