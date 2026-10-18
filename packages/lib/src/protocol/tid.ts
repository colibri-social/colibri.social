const S32_CHARS = "234567abcdefghijklmnopqrstuvwxyz";

let lastMicros = 0;
let clockId = -1;

export const nextTid = (): string => {
	if (clockId < 0) clockId = Math.floor(Math.random() * 1024);

	let micros = Date.now() * 1000;
	if (micros <= lastMicros) micros = lastMicros + 1;
	lastMicros = micros;

	let value = (BigInt(micros) << 10n) | BigInt(clockId);
	let str = "";
	for (let i = 0; i < 13; i++) {
		str = S32_CHARS[Number(value & 31n)] + str;
		value >>= 5n;
	}
	return str;
};
