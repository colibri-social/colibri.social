export const formatClock = (seconds: number) => {
	const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const rest = String(safe % 60).padStart(2, "0");
	if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
	return `${minutes}:${rest}`;
};
