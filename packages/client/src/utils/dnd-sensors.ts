export const isSensorRegistered = (
	sensors: Record<string | number, unknown>,
	id: string | number,
): boolean => sensors[id] !== undefined;
