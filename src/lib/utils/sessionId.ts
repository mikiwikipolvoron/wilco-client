export function getSessionIdFromUrl(): string | null {
	const params = new URLSearchParams(window.location.search);
	return params.get("session");
}
