import { SERVER_BEATS_EVENTS, type ServerEvent } from "@mikiwikipolvoron/wilco/events";
import { useEffect } from "react";
import { useBeatsStore } from "../stores/useBeatsStore";
import { useSocketStore } from "../stores/useSocketStore";
import { useServerStore } from "../stores/useServerStore";

export function useBeatsSync() {
	const socket = useSocketStore((state) => state.socket);
	const { setPhase, updateTeamAccuracy, updatePersonalAccuracy } = useBeatsStore();
	const players = useServerStore((state) => state.players);

	useEffect(() => {
		if (!socket) return;

		function handleServerEvent(event: ServerEvent) {
			// Only handle beats-related events
			if (!SERVER_BEATS_EVENTS.some((et) => et === event.type)) return;

			switch (event.type) {
				case "beat_phase_change":
					setPhase(event.phase, event.round, event.bpm);
					break;

				case "beat_team_sync_update": {
					// Find the player's group and update accuracy
					const myPlayerId = socket?.id;
					const myPlayer = myPlayerId ? players[myPlayerId] : null;
					const myGroupId = myPlayer?.groupId;

					if (myGroupId) {
						const myGroup = event.groupAccuracies.find(g => g.groupId === myGroupId);
						if (myGroup) {
							// Update team accuracy
							updateTeamAccuracy(myGroup.accuracy);
							// For now, show team accuracy as personal accuracy
							// TODO: Server should calculate and send per-player accuracy
							updatePersonalAccuracy(myGroup.accuracy);
						}
					}
					break;
				}
			}
		}

		socket.on("server_event", handleServerEvent);

		return () => {
			socket.off("server_event", handleServerEvent);
		};
	}, [socket, setPhase, updateTeamAccuracy, updatePersonalAccuracy, players]);
}
