import { useEffect } from "react";
import { useSocketStore } from "../stores/useSocketStore";
import { useBeatsStore } from "../stores/useBeatsStore";
import type { ServerEvent } from "wilco-msgs/src/event";

export function useBeatsSync() {
	const socket = useSocketStore((state) => state.socket);
	const { setPhase } = useBeatsStore();

	useEffect(() => {
		if (!socket) return;

		function handleServerEvent(event: ServerEvent) {
			// Only handle beats-related events
			if (event.activity !== "beats") return;

			switch (event.type) {
				case "phase_change":
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
