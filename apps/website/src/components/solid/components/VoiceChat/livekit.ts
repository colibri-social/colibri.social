/**
 * Gets a token for a voice channel room.
 * @param roomName
 * @param identity
 * @returns
 */
export async function fetchToken(
	roomName: string,
	identity: string,
): Promise<string> {
	const params = new URLSearchParams({ room: roomName, identity });
	const res = await fetch(`/api/v1/livekit/token?${params}`);

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Token request failed: ${res.status}`);
	}

	const { token } = await res.json();
	return token;
}
