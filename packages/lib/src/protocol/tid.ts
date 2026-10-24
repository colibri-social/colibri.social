const S32_CHARS = "234567abcdefghijklmnopqrstuvwxyz";
const TID_PATTERN =
	/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

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

export const tidMillis = (tid: string): number | undefined => {
	if (!TID_PATTERN.test(tid)) return undefined;
	let value = 0n;
	for (const char of tid)
		value = (value << 5n) | BigInt(S32_CHARS.indexOf(char));
	return Number(value >> 10n) / 1000;
};

export const FUTURE_SLACK_MS = 15 * 60 * 1000;

export type DatedRecord = {
	rkey?: string;
	createdAt?: string;
};

export const isFutureDated = (
	record: DatedRecord,
	now: number = Date.now(),
): boolean => {
	const latest = now + FUTURE_SLACK_MS;
	const keyTime =
		record.rkey === undefined ? undefined : tidMillis(record.rkey);
	if (keyTime !== undefined && keyTime > latest) return true;
	if (record.createdAt === undefined) return false;
	const createdAt = Date.parse(record.createdAt);
	return !Number.isNaN(createdAt) && createdAt > latest;
};
