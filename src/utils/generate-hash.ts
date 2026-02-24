export const generateHash = async (message: string) => {
	const buffer = new TextEncoder().encode(message);
	const hashBytes = await crypto.subtle.digest("SHA-1", buffer);

	const hash = [...new Uint8Array(hashBytes)]
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");

	return hash;
};
