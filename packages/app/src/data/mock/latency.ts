import { createRandom } from "./seed";

let minimum = 80;
let maximum = 260;
const random = createRandom(0x1a7e);

let scale = 1;

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
	return new Promise<T>((resolve, reject) => {
		setTimeout(() => {
			try {
				resolve(produce());
			} catch (error) {
				reject(error);
			}
		}, wait);
	});
};
