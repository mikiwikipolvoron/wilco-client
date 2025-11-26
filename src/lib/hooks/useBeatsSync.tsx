import { SERVER_BEATS_EVENTS, type ServerEvent } from "@wilco/shared/events";
import { useEffect } from "react";
import { useBeatsStore } from "../stores/useBeatsStore";
import { useSocketStore } from "../stores/useSocketStore";

export function useBeatsSync() {
	const socket = useSocketStore((state) => state.socket);
	const { setPhase, updateTeamAccuracy, updatePersonalAccuracy } = useBeatsStore();

	useEffect(() => {
		if (!socket) return;

		function handleServerEvent(event: ServerEvent) {
			// Only handle beats-related events
			if (!SERVER_BEATS_EVENTS.some((et) => et === event.type)) return;

			switch (event.type) {
				case "beat_phase_change":
					setPhase(event.phase, event.round, event.bpm);
					break;

				// Client doesn't need team_sync_update since they only see their own + team average
				// The server will send personal stats if needed, or we calculate client-side
			}
		}

		socket.on("server_event", handleServerEvent);

		return () => {
			socket.off("server_event", handleServerEvent);
		};
	}, [socket, setPhase]);
}
