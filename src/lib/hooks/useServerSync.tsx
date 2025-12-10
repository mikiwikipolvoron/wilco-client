import type { ServerEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { useEffect } from "react";
import { useServerStore } from "../stores/useServerStore";
import { useSocketStore } from "../stores/useSocketStore";

/** Hook to keep server state synchronized with our own state
 *
 *  Uses `useServerStore` to actually set the state, and `useSocketStore` to
 *  register handlers.
 *
 *  Add all messages under `ServerServiceEvent` type here
 *  (message-types/src/service.ts)
 */
export function useServerSync() {
	const socket = useSocketStore((s) => s.socket);

	useEffect(() => {
		if (!socket) return;
		const store = useServerStore.getState();
		// If you're adding more types to ServerServiceEvent, it helps to change
		// below the `ServerEvent` to `ServerServiceEvent` temporarily to get
		// good suggestions and change it back afterwards!
		const handleServerEvent = (event: ServerEvent) => {
			switch (event.type) {
				case "player_joined":
					store._handlePlayerJoined(event.player);
					break;
				case "player_left":
					store._handlePlayerLeft(event.playerId);
					break;
				case "activity_started":
					store._handleActivityStarted(event.activity);
					break;
				case "groups_updated":
					store._handleGroupsUpdated(event.groups);
					break;
				default:
					break;
			}
		};

		socket.on("server_event", handleServerEvent);
		socket.on("connect", () => store._setConnected(true));
		socket.on("disconnect", () => store._setConnected(false));
		return () => {
			socket.off("server_event", handleServerEvent);
			socket.off("connect");
			socket.off("disconnect");
		};
	}, [socket]);
}
