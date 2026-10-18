export const withDeadline = <T>(
	promise: Promise<T>,
	ms: number,
	reason: () => unknown,
): Promise<T> =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(reason()), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});
